import type {
  RawStopAllResponse,
  RawUnionDeparturesResponse,
  RawUnionTrip,
} from "../metrolinx/types.js";
import type {
  UnionDeparture,
  UnionDeparturesResult,
} from "../schemas/union-departures.js";
import { toIsoWithTorontoOffset } from "../time.js";
import { normalizeSearchStops } from "./search-stops.js";

function normalizeMode(serviceType: string): "train" | "bus" {
  if (serviceType === "T") return "train";
  if (serviceType === "B") return "bus";
  return "bus";
}

// UnionDepartures' Stops carry a name but no stop code — confirmed live
// (issue #9): every Code observed across a full capture was null. Resolved
// via the same fuzzy matcher search_stops uses, since these names are short
// forms of the full Stop/All LocationName ("Exhibition" vs "Exhibition GO").
function resolveStopCode(stopAll: RawStopAllResponse, name: string): string {
  const match = normalizeSearchStops(stopAll, name, "any", 1).matches[0];
  return match?.stop_code ?? "";
}

function normalizeTrip(
  trip: RawUnionTrip,
  stopAll: RawStopAllResponse,
): UnionDeparture {
  const dto: UnionDeparture = {
    trip_number: trip.TripNumber,
    mode: normalizeMode(trip.ServiceType),
    service: trip.Service,
    time: toIsoWithTorontoOffset(trip.Time),
    stops_served: (trip.Stops ?? []).map((s) => ({
      stop_code: s.Code ?? resolveStopCode(stopAll, s.Name),
      stop_name: s.Name,
    })),
  };
  if (trip.Platform && trip.Platform !== "-") dto.platform = trip.Platform;
  return dto;
}

export function normalizeUnionDepartures(
  raw: RawUnionDeparturesResponse,
  stopAll: RawStopAllResponse,
  mode: "train" | "bus" | "any" = "any",
): UnionDeparturesResult {
  const trips = raw.AllDepartures?.Trip ?? [];
  const filtered = trips.filter(
    (t) => mode === "any" || normalizeMode(t.ServiceType) === mode,
  );
  const departures = filtered.map((t) => normalizeTrip(t, stopAll));

  return {
    departures,
    truncated: false,
    total_matched: departures.length,
  };
}
