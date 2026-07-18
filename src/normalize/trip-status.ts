import { MetrolinxError } from "../errors.js";
import type {
  RawStopAllResponse,
  RawTripStatusEntry,
  RawTripStatusResponse,
  RawTripStatusStop,
} from "../metrolinx/types.js";
import type {
  TripStatusResult,
  TripStatusStop,
} from "../schemas/trip-status.js";
import { combineDateAndHhmm } from "../time.js";

// Same S/M vocabulary already confirmed for Stop/NextService's Status field
// (tool-schemas spec §5): S = scheduled, M = modified. Confirmed live
// (issue #8 follow-up) on both Schedule/Trip's top-level trip Status and
// each stop's own Status field. An empty string (observed on a trip's
// not-yet-scheduled terminal stop) passes through unchanged.
function expandScheduleStatus(status: string): string {
  if (status === "S") return "scheduled";
  if (status === "M") return "modified";
  return status;
}

function isoOrUndefined(
  date: string,
  hhmm: string | undefined | null,
): string | undefined {
  return hhmm ? combineDateAndHhmm(date, hhmm) : undefined;
}

function buildStopNames(stopAll: RawStopAllResponse): Map<string, string> {
  const names = new Map<string, string>();
  for (const entry of stopAll.Stations?.Station ?? []) {
    names.set(entry.LocationCode, entry.LocationName);
    if (entry.PublicStopId) names.set(entry.PublicStopId, entry.LocationName);
  }
  return names;
}

// Longitude/Latitude are 0/0 when the trip isn't currently tracked
// (confirmed live, issue #8 follow-up) — a different placeholder than
// Stop/NextService's -1/-1. Both are treated as "not tracked" defensively.
function tripPosition(
  trip: RawTripStatusEntry,
): { lat: number; lon: number } | undefined {
  const lat = Number(trip.Latitude);
  const lon = Number(trip.Longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return undefined;
  if (lat === 0 && lon === 0) return undefined;
  if (lat === -1 && lon === -1) return undefined;
  return { lat, lon };
}

function normalizeTripStop(
  stop: RawTripStatusStop,
  stopNames: Map<string, string>,
  date: string,
): TripStatusStop {
  const track: TripStatusStop["track"] = {};
  if (stop.Track?.Scheduled) track.scheduled = stop.Track.Scheduled;
  if (stop.Track?.Actual) track.actual = stop.Track.Actual;

  const result: TripStatusStop = {
    stop_code: stop.Code,
    stop_name: stopNames.get(stop.Code) ?? stop.Code,
    track,
    status: expandScheduleStatus(stop.Status),
  };

  const scheduledArrival = isoOrUndefined(date, stop.ArrivalTime?.Scheduled);
  if (scheduledArrival) result.scheduled_arrival = scheduledArrival;
  const expectedArrival = isoOrUndefined(date, stop.ArrivalTime?.Computed);
  if (expectedArrival) result.expected_arrival = expectedArrival;
  const scheduledDeparture = isoOrUndefined(
    date,
    stop.DepartureTime?.Scheduled,
  );
  if (scheduledDeparture) result.scheduled_departure = scheduledDeparture;
  const expectedDeparture = isoOrUndefined(date, stop.DepartureTime?.Computed);
  if (expectedDeparture) result.expected_departure = expectedDeparture;

  return result;
}

/**
 * @param date The operational day requested (YYYY-MM-DD), used to anchor
 * Schedule/Trip's bare "HH:MM" stop times — the raw payload carries no date
 * component of its own (confirmed live, issue #8 follow-up).
 */
export function normalizeTripStatus(
  raw: RawTripStatusResponse,
  stopAll: RawStopAllResponse,
  date: string,
): TripStatusResult {
  const trip = raw.Trips?.[0];
  if (!trip) {
    throw new MetrolinxError(
      "not_found",
      "No trip matches that number/date. Verify the trip number via " +
        "get_next_service or get_union_departures.",
      false,
    );
  }

  const stopNames = buildStopNames(stopAll);
  const position = tripPosition(trip);

  return {
    trip_number: trip.Number,
    destination: stopNames.get(trip.Destination) ?? trip.Destination,
    status: expandScheduleStatus(trip.Status),
    ...(position ? { position } : {}),
    stops: (trip.Stops ?? []).map((stop) =>
      normalizeTripStop(stop, stopNames, date),
    ),
  };
}
