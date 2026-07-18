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
// stamps departFromCode/destinationStopCode with journey-level endpoints,
// so those codes can't be trusted as per-leg boundaries on any multi-leg
// journey. Note: no multi-leg journey has ever been observed live —
// Schedule/Journey returned SchJourneys: [] for a cross-line pair the
// official site routes via a transfer (tool-schemas spec §5) — this is
// defensive correctness from the fixture evidence, not a confirmed shape.
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

// Via-Union transfer composition (ADR 0002): Schedule/Journey only returns
// single-service journeys — both documented endpoint variants confirmed live
// (2026-07-18) to return SchJourneys: [] for a cross-line pair the official
// planner routes via a transfer. Union is GO's hub, so when a direct query
// comes back empty, plan_trip composes one transfer there from two journey
// calls. Each leg is upstream-attested; only the pairing is ours. The
// transfer buffer is a starting heuristic (same spirit as the arrive_by
// window, spec §5); bus-hub composition is a separate grilled decision.
const UNION_STOP_CODE = "UN";
const MIN_TRANSFER_MINUTES = 10;

function isoToMs(iso: string): number {
  return new Date(iso).getTime();
}

// Toronto-local clock of one of our own ISO outputs
// ("2026-07-20T08:50:00-04:00" -> "08:50") — safe to slice because every
// itinerary timestamp is produced by combineDateAndHhmm/toIsoWithTorontoOffset.
function hhmmOfIso(iso: string): string {
  return iso.slice(11, 16);
}

function combine(first: Itinerary, second: Itinerary): Itinerary {
  const legs = [...first.legs, ...second.legs];
  return {
    departure_time: first.departure_time,
    arrival_time: second.arrival_time,
    duration_minutes: Math.round(
      (isoToMs(second.arrival_time) - isoToMs(first.departure_time)) / 60_000,
    ),
    transfers: legs.length - 1,
    accessible: first.accessible && second.accessible,
    legs,
  };
}

async function composeViaUnion(
  client: MetrolinxClient,
  fromStopCode: string,
  toStopCode: string,
  date: string,
  time: string,
  maxResults: number,
  stopNames: Map<string, string>,
): Promise<Itinerary[]> {
  const inbound = await fetchItineraries(
    client,
    fromStopCode,
    UNION_STOP_CODE,
    date,
    time,
    maxResults,
    stopNames,
  );
  if (inbound.length === 0) return [];

  const earliest = inbound.reduce((a, b) =>
    isoToMs(a.arrival_time) <= isoToMs(b.arrival_time) ? a : b,
  );
  const onward = await fetchItineraries(
    client,
    UNION_STOP_CODE,
    toStopCode,
    date,
    hhmmOfIso(earliest.arrival_time),
    maxResults,
    stopNames,
  );

  const combined: Itinerary[] = [];
  for (const first of inbound) {
    const readyMs = isoToMs(first.arrival_time) + MIN_TRANSFER_MINUTES * 60_000;
    const second = onward.find(
      (candidate) => isoToMs(candidate.departure_time) >= readyMs,
    );
    if (second) combined.push(combine(first, second));
  }
  return combined.slice(0, maxResults);
}

// Direct query first; the via-Union fallback only runs when it comes back
// empty and neither endpoint already is Union, so every currently-working
// direct journey is untouched. Worst case 3 upstream calls (6 under
// arrive_by's widening retry).
async function fetchDirectOrComposed(
  client: MetrolinxClient,
  query: JourneyQuery,
  time: string,
  stopNames: Map<string, string>,
): Promise<Itinerary[]> {
  const direct = await fetchItineraries(
    client,
    query.from,
    query.to,
    query.date,
    time,
    query.maxResults,
    stopNames,
  );
  if (direct.length > 0 || !query.viaUnionFallback) return direct;
  if (query.from === UNION_STOP_CODE || query.to === UNION_STOP_CODE) {
    return direct;
  }
  return composeViaUnion(
    client,
    query.from,
    query.to,
    query.date,
    time,
    query.maxResults,
    stopNames,
  );
}

// arrive_by is emulated (tool-schemas spec §2.1): one Schedule/Journey call
// with StartTime back-shifted, filtered on arrival <= target, one retry with
// a wider window if empty. Both windows are starting heuristics to tune
// against real journey data (spec §5).
const ARRIVE_BY_BACKSHIFT_HOURS = 2;
const ARRIVE_BY_WIDE_BACKSHIFT_HOURS = 4;

async function itinerariesArrivingBy(
  client: MetrolinxClient,
  query: JourneyQuery,
  stopNames: Map<string, string>,
  backshiftHours: number,
): Promise<Itinerary[]> {
  const startTime = addHoursToTime(query.time, -backshiftHours);
  const itineraries = await fetchDirectOrComposed(
    client,
    query,
    startTime,
    stopNames,
  );
  const targetMs = new Date(
    combineDateAndHhmm(query.date, query.time),
  ).getTime();
  return itineraries.filter(
    (itinerary) => new Date(itinerary.arrival_time).getTime() <= targetMs,
  );
}

export interface JourneyQuery {
  from: string;
  to: string;
  date: string;
  time: string;
  timeMode: "depart_after" | "arrive_by";
  maxResults: number;
  /** plan_trip composes via-Union transfers; plan_journey stays a raw mirror. */
  viaUnionFallback: boolean;
}

export async function planItineraries(
  client: MetrolinxClient,
  query: JourneyQuery,
  stopNames: Map<string, string>,
): Promise<Itinerary[]> {
  if (query.timeMode === "depart_after") {
    return fetchDirectOrComposed(client, query, query.time, stopNames);
  }

  const narrow = await itinerariesArrivingBy(
    client,
    query,
    stopNames,
    ARRIVE_BY_BACKSHIFT_HOURS,
  );
  if (narrow.length > 0) return narrow;

  return itinerariesArrivingBy(
    client,
    query,
    stopNames,
    ARRIVE_BY_WIDE_BACKSHIFT_HOURS,
  );
}
