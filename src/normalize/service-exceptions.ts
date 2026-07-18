import type {
  RawExceptionStop,
  RawExceptionTrip,
  RawServiceExceptionsResponse,
} from "../metrolinx/types.js";
import type {
  AffectedStop,
  Exception,
  ServiceExceptionsResult,
} from "../schemas/service-exceptions.js";
import { toIsoWithTorontoOffset } from "../time.js";

// Raw stops carry separate SchArrival/SchDeparture; the DTO wants one
// scheduled_time per affected stop. Departure preferred (matches the rest
// of the codebase's departure-first convention, e.g. Stop/NextService),
// falling back to arrival for a trip's final stop.
function scheduledTime(stop: RawExceptionStop): string {
  const naive = stop.SchDeparture ?? stop.SchArrival;
  return naive ? toIsoWithTorontoOffset(naive) : "";
}

function normalizeStop(stop: RawExceptionStop): AffectedStop {
  const dto: AffectedStop = {
    stop_code: stop.Code,
    stop_name: stop.Name,
    scheduled_time: scheduledTime(stop),
    cancelled: stop.IsCancelled,
  };
  if (stop.ActualTime)
    dto.actual_time = toIsoWithTorontoOffset(stop.ActualTime);
  return dto;
}

function normalizeTrip(trip: RawExceptionTrip): Exception {
  // "affected_stops" per the field's own name — only stops actually flagged
  // cancelled or overridden, not every stop on the trip (anti-dump, same
  // spirit as get_line_schedule's two-mode design).
  const affected = (trip.Stop ?? []).filter(
    (s) => s.IsCancelled || s.IsOverride,
  );
  return {
    trip_number: trip.TripNumber,
    trip_name: trip.TripName,
    cancelled: trip.IsCancelled,
    affected_stops: affected.map(normalizeStop),
  };
}

export function normalizeServiceExceptions(
  raw: RawServiceExceptionsResponse,
): ServiceExceptionsResult {
  const exceptions = (raw.Trip ?? []).map(normalizeTrip);
  return {
    exceptions,
    truncated: false,
    total_matched: exceptions.length,
  };
}
