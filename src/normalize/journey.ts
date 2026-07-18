import type { MetrolinxClient } from "../metrolinx/client.js";
import type {
  RawJourneyResponse,
  RawJourneyService,
  RawJourneyStop,
  RawJourneyTrip,
} from "../metrolinx/types.js";
import type { Itinerary, ItineraryLeg } from "../schemas/journey.js";
import {
  addHoursToTime,
  combineDateAndHhmm,
  dateToWire,
  diffMinutes,
  hhmmToWire,
  toIsoWithTorontoOffset,
} from "../time.js";

// GO Transit's known line roster. Schedule/Journey's Trip object carries no
// line-name field (only Line/LineVariant codes and a Display string that
// mixes the code with the destination, e.g. "LW - Aldershot GO") — same gap
// and same best-effort static map already used for get_stop_destinations.
const LINE_NAMES: Record<string, string> = {
  LW: "Lakeshore West",
  LE: "Lakeshore East",
  MI: "Milton",
  GT: "Kitchener",
  RH: "Richmond Hill",
  BR: "Barrie",
  ST: "Stouffville",
  UP: "UP Express",
};

// Mirrors Stop/NextService's ServiceType (T/B) single-letter vocabulary
// (tool-schemas spec §1.1) — not yet independently confirmed for this
// endpoint's Trip.Type field, same best-effort default as normalize/next-service.ts.
function normalizeLegMode(type: string): "train" | "bus" {
  return type === "B" ? "bus" : "train";
}

function firstAndLastByOrder(
  stops: RawJourneyStop[],
): [RawJourneyStop, RawJourneyStop] {
  let first = stops[0]!;
  let last = stops[0]!;
  for (const stop of stops) {
    if (stop.Order < first.Order) first = stop;
    if (stop.Order > last.Order) last = stop;
  }
  return [first, last];
}

// Leg boundaries come from the trip's own Stops list, not from
// departFromCode/destinationStopCode. The captured fixture shows upstream
// trims each trip's Stops to the ridden portion (trip 1961's Display says
// "Niagara Falls GO" yet its Stops end at the journey destination OA) and
// stamps departFromCode/destinationStopCode with journey-level endpoints —
// on a transfer journey those codes don't appear in intermediate legs'
// Stops at all, so requiring them dropped every leg and returned empty
// itineraries for any cross-line trip (observed live, Unionville GO ->
// Exhibition GO). First/last by Order is provably identical for the
// captured direct-journey fixture.
function normalizeLeg(
  trip: RawJourneyTrip,
  journeyDate: string,
  stopNames: Map<string, string>,
): ItineraryLeg | undefined {
  const stops = trip.Stops?.Stop ?? [];
  if (stops.length === 0) return undefined;
  const [first, last] = firstAndLastByOrder(stops);

  return {
    mode: normalizeLegMode(trip.Type),
    line_code: trip.Line,
    line_name: LINE_NAMES[trip.Line] ?? trip.Line,
    direction: trip.Direction,
    from: {
      stop_code: first.Code,
      stop_name: stopNames.get(first.Code) ?? first.Code,
      time: combineDateAndHhmm(journeyDate, first.Time),
    },
    to: {
      stop_code: last.Code,
      stop_name: stopNames.get(last.Code) ?? last.Code,
      time: combineDateAndHhmm(journeyDate, last.Time),
    },
    trip_number: trip.Number,
  };
}

function normalizeService(
  service: RawJourneyService,
  journeyDate: string,
  stopNames: Map<string, string>,
): Itinerary | undefined {
  const legs = (service.Trips?.Trip ?? [])
    .map((trip) => normalizeLeg(trip, journeyDate, stopNames))
    .filter((leg): leg is ItineraryLeg => leg !== undefined);
  if (legs.length === 0) return undefined;

  return {
    departure_time: toIsoWithTorontoOffset(service.StartTime),
    arrival_time: toIsoWithTorontoOffset(service.EndTime),
    duration_minutes: diffMinutes(service.EndTime, service.StartTime),
    transfers: legs.length - 1,
    // "" / "R" / "B" / "RB" (tool-schemas spec §5 pattern, unconfirmed
    // positive case) — any non-empty code collapses to accessible: true.
    accessible: service.Accessible !== "",
    legs,
  };
}

/**
 * Raw journey response -> itinerary DTOs. Journey trips carry no stop names
 * of their own (same gap as Schedule/Trip) — resolved via a stop_code ->
 * stop_name index built from the cached Stop/All dataset (get_trip_status
 * precedent), passed in by the caller.
 */
export function normalizeJourney(
  raw: RawJourneyResponse,
  stopNames: Map<string, string>,
): Itinerary[] {
  const entry = raw.SchJourneys?.[0];
  if (!entry) return [];

  const itineraries: Itinerary[] = [];
  for (const service of entry.Services ?? []) {
    const itinerary = normalizeService(service, entry.Date, stopNames);
    if (itinerary) itineraries.push(itinerary);
  }
  return itineraries;
}

async function fetchItineraries(
  client: MetrolinxClient,
  fromStopCode: string,
  toStopCode: string,
  date: string,
  time: string,
  maxResults: number,
  stopNames: Map<string, string>,
): Promise<Itinerary[]> {
  const raw = await client.getJourney(
    dateToWire(date),
    fromStopCode,
    toStopCode,
    hhmmToWire(time),
    maxResults,
  );
  return normalizeJourney(raw, stopNames);
}

// arrive_by is emulated (tool-schemas spec §2.1): one Schedule/Journey call
// with StartTime back-shifted, filtered on arrival <= target, one retry with
// a wider window if empty. Both windows are starting heuristics to tune
// against real journey data (spec §5).
const ARRIVE_BY_BACKSHIFT_HOURS = 2;
const ARRIVE_BY_WIDE_BACKSHIFT_HOURS = 4;

async function itinerariesArrivingBy(
  client: MetrolinxClient,
  fromStopCode: string,
  toStopCode: string,
  date: string,
  targetTime: string,
  maxResults: number,
  stopNames: Map<string, string>,
  backshiftHours: number,
): Promise<Itinerary[]> {
  const startTime = addHoursToTime(targetTime, -backshiftHours);
  const itineraries = await fetchItineraries(
    client,
    fromStopCode,
    toStopCode,
    date,
    startTime,
    maxResults,
    stopNames,
  );
  const targetMs = new Date(combineDateAndHhmm(date, targetTime)).getTime();
  return itineraries.filter(
    (itinerary) => new Date(itinerary.arrival_time).getTime() <= targetMs,
  );
}

export async function planItineraries(
  client: MetrolinxClient,
  fromStopCode: string,
  toStopCode: string,
  date: string,
  time: string,
  timeMode: "depart_after" | "arrive_by",
  maxResults: number,
  stopNames: Map<string, string>,
): Promise<Itinerary[]> {
  if (timeMode === "depart_after") {
    return fetchItineraries(
      client,
      fromStopCode,
      toStopCode,
      date,
      time,
      maxResults,
      stopNames,
    );
  }

  const narrow = await itinerariesArrivingBy(
    client,
    fromStopCode,
    toStopCode,
    date,
    time,
    maxResults,
    stopNames,
    ARRIVE_BY_BACKSHIFT_HOURS,
  );
  if (narrow.length > 0) return narrow;

  return itinerariesArrivingBy(
    client,
    fromStopCode,
    toStopCode,
    date,
    time,
    maxResults,
    stopNames,
    ARRIVE_BY_WIDE_BACKSHIFT_HOURS,
  );
}
