import type {
  RawGtfsVehiclePositionsResponse,
  RawServiceGlanceResponse,
  RawServiceGlanceTrip,
  RawStopAllResponse,
} from "../metrolinx/types.js";
import type {
  VehiclePosition,
  VehiclePositionsResult,
} from "../schemas/vehicle-positions.js";
import { toIsoWithTorontoOffset } from "../time.js";
import { resolveStopCode } from "./search-stops.js";

type VehicleMode = VehiclePosition["mode"];

export interface VehiclePositionFilters {
  line_code?: string | undefined;
  trip_number?: string | undefined;
}

function buildStopNameMap(stopAll: RawStopAllResponse): Map<string, string> {
  const map = new Map<string, string>();
  for (const entry of stopAll.Stations?.Station ?? []) {
    map.set(resolveStopCode(entry), entry.LocationName);
  }
  return map;
}

// GTFS-RT trip_id / route_id encode "<date>-<lineOrRouteCode>-<tripNumber>"
// / "<feedVersion>-<lineOrRouteCode>" (confirmed live against the real
// TripUpdates capture, issue #3/#11) — the trip number is always the last
// dash-delimited segment, uniformly for train line codes (e.g. "LW") and
// numeric bus route codes.
function lastSegment(id: string): string {
  const parts = id.split("-");
  return parts[parts.length - 1] ?? id;
}

function buildOccupancyMap(
  positions: RawGtfsVehiclePositionsResponse,
): Map<string, number> {
  const map = new Map<string, number>();
  for (const entity of positions.entity) {
    const vehicle = entity.vehicle;
    if (!vehicle || vehicle.occupancy_percentage == null) continue;
    map.set(lastSegment(vehicle.trip.trip_id), vehicle.occupancy_percentage);
  }
  return map;
}

function normalizeVehicle(
  trip: RawServiceGlanceTrip,
  mode: VehicleMode,
  stopNames: Map<string, string>,
  occupancy: Map<string, number>,
): VehiclePosition {
  const vehicle: VehiclePosition = {
    trip_number: trip.TripNumber,
    line_code: trip.LineCode,
    mode,
    position: { lat: trip.Latitude, lon: trip.Longitude },
    delay_minutes: Math.round(trip.DelaySeconds / 60),
    in_motion: trip.IsInMotion,
    updated_at: toIsoWithTorontoOffset(trip.ModifiedDate),
  };

  const occupancyPercent = occupancy.get(trip.TripNumber);
  if (occupancyPercent !== undefined) {
    vehicle.occupancy_percent = occupancyPercent;
  }

  if (trip.NextStopCode) {
    vehicle.next_stop = {
      stop_code: trip.NextStopCode,
      stop_name: stopNames.get(trip.NextStopCode) ?? trip.NextStopCode,
    };
  }

  return vehicle;
}

export function normalizeVehiclePositions(
  glance: RawServiceGlanceResponse,
  positions: RawGtfsVehiclePositionsResponse,
  stopAll: RawStopAllResponse,
  mode: VehicleMode,
  filters: VehiclePositionFilters,
  limit: number,
): VehiclePositionsResult {
  const stopNames = buildStopNameMap(stopAll);
  const occupancy = buildOccupancyMap(positions);
  const trips = glance.Trips?.Trip ?? [];

  const matched = trips.filter(
    (trip) =>
      (!filters.line_code || trip.LineCode === filters.line_code) &&
      (!filters.trip_number || trip.TripNumber === filters.trip_number),
  );

  const totalMatched = matched.length;
  const vehicles = matched
    .slice(0, limit)
    .map((trip) => normalizeVehicle(trip, mode, stopNames, occupancy));

  return {
    vehicles,
    truncated: totalMatched > limit,
    total_matched: totalMatched,
  };
}
