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
import { toIsoWithTorontoOffset } from "../time.js";

function isoOrUndefined(naive: string | undefined | null): string | undefined {
  return naive ? toIsoWithTorontoOffset(naive) : undefined;
}

function buildStopNames(stopAll: RawStopAllResponse): Map<string, string> {
  const names = new Map<string, string>();
  for (const entry of stopAll.Stations?.Station ?? []) {
    names.set(entry.LocationCode, entry.LocationName);
    if (entry.PublicStopId) names.set(entry.PublicStopId, entry.LocationName);
  }
  return names;
}

// Latitude/Longitude use the same -1/-1 "not currently tracked" placeholder
// observed on Stop/NextService (tool-schemas spec §5) while a trip hasn't
// yet departed.
function tripPosition(
  trip: RawTripStatusEntry,
): { lat: number; lon: number } | undefined {
  const lat = Number(trip.Latitude);
  const lon = Number(trip.Longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return undefined;
  if (lat === -1 && lon === -1) return undefined;
  return { lat, lon };
}

function normalizeTripStop(
  stop: RawTripStatusStop,
  stopNames: Map<string, string>,
): TripStatusStop {
  const track: TripStatusStop["track"] = {};
  if (stop.Track?.Scheduled) track.scheduled = stop.Track.Scheduled;
  if (stop.Track?.Actual) track.actual = stop.Track.Actual;

  const result: TripStatusStop = {
    stop_code: stop.Code,
    stop_name: stopNames.get(stop.Code) ?? stop.Code,
    track,
    status: stop.Status,
  };

  const scheduledArrival = isoOrUndefined(stop.ArrivalTime?.Scheduled);
  if (scheduledArrival) result.scheduled_arrival = scheduledArrival;
  const expectedArrival = isoOrUndefined(stop.ArrivalTime?.Computed);
  if (expectedArrival) result.expected_arrival = expectedArrival;
  const scheduledDeparture = isoOrUndefined(stop.DepartureTime?.Scheduled);
  if (scheduledDeparture) result.scheduled_departure = scheduledDeparture;
  const expectedDeparture = isoOrUndefined(stop.DepartureTime?.Computed);
  if (expectedDeparture) result.expected_departure = expectedDeparture;

  return result;
}

export function normalizeTripStatus(
  raw: RawTripStatusResponse,
  stopAll: RawStopAllResponse,
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
    destination: trip.Destination,
    status: trip.Status,
    ...(position ? { position } : {}),
    stops: (trip.Stops ?? []).map((stop) => normalizeTripStop(stop, stopNames)),
  };
}
