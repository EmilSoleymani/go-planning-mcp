import type {
  RawConsist,
  RawFleetConsistResponse,
} from "../metrolinx/types.js";
import type { FleetConsistResult } from "../schemas/fleet-consist.js";

/** The consist currently assigned to a trip, found by scanning each consist's remaining-trip list. */
export function findConsistByTrip(
  raw: RawFleetConsistResponse,
  tripNumber: string,
): RawConsist | undefined {
  const consists = raw.AllConsists?.Consists ?? [];
  return consists.find((consist) =>
    (consist.RemainingTrip ?? []).some((trip) => trip.Number === tripNumber),
  );
}

/** Fleet/Consist/Engine/{EngineNumber} returns the AllConsists shape filtered to one engine. */
export function firstConsist(
  raw: RawFleetConsistResponse,
): RawConsist | undefined {
  return raw.AllConsists?.Consists?.[0];
}

export function normalizeFleetConsist(consist: RawConsist): FleetConsistResult {
  return {
    engine_number: consist.EngineNumber,
    coach_count: consist.CoachCount,
    cars: (consist.Lineup ?? []).map((car) => ({
      type: car.Type,
      order: car.Order,
      number: car.Number,
    })),
    // start_time/end_time formats aren't live-confirmed (no Fleet access this
    // session, see metrolinx/types.ts) — passed through as opaque strings
    // rather than guessed at, same treatment as get_trip_status's status
    // fields (issue #8/#22).
    remaining_trips: (consist.RemainingTrip ?? []).map((trip) => ({
      trip_number: trip.Number,
      line: trip.Corridor,
      start_time: trip.StartTime,
      end_time: trip.EndTime,
    })),
  };
}
