import type {
  RawGtfsStopTimeEvent,
  RawGtfsStopTimeUpdate,
  RawGtfsTripUpdate,
  RawGtfsTripUpdatesResponse,
} from "../metrolinx/types.js";
import type {
  StopUpdate,
  TripUpdate,
  TripUpdatesResult,
} from "../schemas/trip-updates.js";
import { toIsoFromEpochSeconds } from "../time.js";

export interface TripUpdateFilters {
  line_code?: string | undefined;
  trip_number?: string | undefined;
  stop_code?: string | undefined;
}

// GTFS-RT trip_id / route_id encode "<date>-<lineOrRouteCode>-<tripNumber>"
// / "<feedVersion>-<lineOrRouteCode>" (confirmed live, issue #3/#11) — the
// trip number / line code is always the last dash-delimited segment.
function lastSegment(id: string): string {
  const parts = id.split("-");
  return parts[parts.length - 1] ?? id;
}

function expandScheduleRelationship(relationship: string): string {
  if (relationship === "SCHEDULED") return "scheduled";
  if (relationship === "SKIPPED") return "skipped";
  if (relationship === "CANCELED") return "cancelled";
  return relationship;
}

function stopEventIso(event: RawGtfsStopTimeEvent | null | undefined): {
  scheduled?: string;
  expected?: string;
} {
  if (!event || event.time == null) return {};
  const expected = toIsoFromEpochSeconds(event.time);
  if (event.delay == null) return { expected };
  return {
    scheduled: toIsoFromEpochSeconds(event.time - event.delay),
    expected,
  };
}

function normalizeStopUpdate(raw: RawGtfsStopTimeUpdate): StopUpdate {
  const arrival = stopEventIso(raw.arrival);
  const departure = stopEventIso(raw.departure);

  const stopUpdate: StopUpdate = {
    stop_code: raw.stop_id,
    status: expandScheduleRelationship(raw.schedule_relationship),
  };
  if (arrival.scheduled) stopUpdate.scheduled_arrival = arrival.scheduled;
  if (arrival.expected) stopUpdate.expected_arrival = arrival.expected;
  if (departure.scheduled) stopUpdate.scheduled_departure = departure.scheduled;
  if (departure.expected) stopUpdate.expected_departure = departure.expected;
  return stopUpdate;
}

// Confirmed live (issue #3/#11): a trip's delay is constant across every
// stop_time_update entry — take the first one seen rather than averaging.
function tripDelayMinutes(stopTimeUpdates: RawGtfsStopTimeUpdate[]): number {
  for (const stu of stopTimeUpdates) {
    const event = stu.departure ?? stu.arrival;
    if (event?.delay != null) return Math.round(event.delay / 60);
  }
  return 0;
}

// "Material update" per the tool-schemas spec §2.16: cancelled trumps
// modified (partial stop cancellation/skip) trumps a >=3min delay; anything
// else is on_time. The same threshold drives both this per-trip status and
// the unfiltered-call disruptions-only filter below, by design.
function tripStatus(
  tripUpdate: RawGtfsTripUpdate,
  delayMinutes: number,
): TripUpdate["status"] {
  if (tripUpdate.trip.schedule_relationship === "CANCELED") return "cancelled";
  if (
    tripUpdate.stop_time_update.some(
      (stu) => stu.schedule_relationship === "SKIPPED",
    )
  ) {
    return "modified";
  }
  if (delayMinutes >= 3) return "delayed";
  return "on_time";
}

function normalizeOne(tripUpdate: RawGtfsTripUpdate): TripUpdate {
  const delayMinutes = tripDelayMinutes(tripUpdate.stop_time_update);
  return {
    trip_number: lastSegment(tripUpdate.trip.trip_id),
    line_code: lastSegment(tripUpdate.trip.route_id),
    // direction_id (0/1) has no confirmed mapping to Metrolinx's line-scoped
    // direction codes without list_lines (not yet implemented) — left unset
    // rather than guessed, per the tool-schemas spec's "populated when
    // upstream provides them" allowance.
    status: tripStatus(tripUpdate, delayMinutes),
    delay_minutes: delayMinutes,
    stop_updates: tripUpdate.stop_time_update.map(normalizeStopUpdate),
    updated_at: toIsoFromEpochSeconds(tripUpdate.timestamp),
  };
}

export function normalizeTripUpdates(
  raw: RawGtfsTripUpdatesResponse,
  filters: TripUpdateFilters,
  limit: number,
): TripUpdatesResult {
  const hasFilter = Boolean(
    filters.line_code ?? filters.trip_number ?? filters.stop_code,
  );

  const updates = raw.entity
    .map((entity) => entity.trip_update)
    .filter((tripUpdate): tripUpdate is RawGtfsTripUpdate => tripUpdate != null)
    .map(normalizeOne);

  const matched = updates.filter((update) => {
    if (filters.line_code && update.line_code !== filters.line_code) {
      return false;
    }
    if (filters.trip_number && update.trip_number !== filters.trip_number) {
      return false;
    }
    if (
      filters.stop_code &&
      !update.stop_updates.some((stu) => stu.stop_code === filters.stop_code)
    ) {
      return false;
    }
    if (!hasFilter && update.status === "on_time") return false;
    return true;
  });

  const totalMatched = matched.length;
  return {
    updates: matched.slice(0, limit),
    truncated: totalMatched > limit,
    total_matched: totalMatched,
  };
}
