import { MetrolinxError } from "../errors.js";
import type {
  RawLineScheduleResponse,
  RawLineScheduleStop,
  RawLineScheduleTrip,
} from "../metrolinx/types.js";
import type {
  LineScheduleResult,
  ScheduleTrip,
} from "../schemas/line-schedule.js";
import { toIsoWithTorontoOffset } from "../time.js";

function firstAndLastStop(
  stops: RawLineScheduleStop[],
): [RawLineScheduleStop, RawLineScheduleStop] {
  let first = stops[0]!;
  let last = stops[0]!;
  for (const stop of stops) {
    if (stop.Order < first.Order) first = stop;
    if (stop.Order > last.Order) last = stop;
  }
  return [first, last];
}

function summaryTrip(trip: RawLineScheduleTrip): ScheduleTrip | undefined {
  const stops = trip.Stops ?? [];
  if (stops.length === 0) return undefined;
  const [first, last] = firstAndLastStop(stops);
  return {
    trip_number: trip.Number,
    display: trip.Display,
    departs_first_stop: toIsoWithTorontoOffset(first.Time),
    arrives_last_stop: toIsoWithTorontoOffset(last.Time),
  };
}

function stopTimeTrip(
  trip: RawLineScheduleTrip,
  stopCode: string,
): ScheduleTrip | undefined {
  const stop = (trip.Stops ?? []).find((s) => s.Code === stopCode);
  if (!stop) return undefined;
  return {
    trip_number: trip.Number,
    display: trip.Display,
    time: toIsoWithTorontoOffset(stop.Time),
  };
}

// Schedule/Line/{Date}/{LineCode}/{LineDirection} is already scoped by the
// request URL, so the response carries at most one Lines.Line entry for that
// line/direction (confirmed live, issue #3 fixture capture).
export function normalizeLineSchedule(
  raw: RawLineScheduleResponse,
  stopCode?: string,
): LineScheduleResult {
  const entry = raw.Lines?.Line?.[0];
  if (!entry) {
    throw new MetrolinxError(
      "not_found",
      "No schedule for that line/direction. Verify both via list_lines.",
      false,
    );
  }

  const trips: ScheduleTrip[] = [];
  for (const trip of entry.Trip ?? []) {
    const mapped = stopCode ? stopTimeTrip(trip, stopCode) : summaryTrip(trip);
    if (mapped) trips.push(mapped);
  }

  return {
    trips,
    truncated: false,
    total_matched: trips.length,
  };
}
