import type {
  RawNextServiceLine,
  RawNextServiceResponse,
} from "../metrolinx/types.js";
import type { Departure, NextServiceResult } from "../schemas/next-service.js";
import { diffMinutes, toIsoWithTorontoOffset } from "../time.js";

function normalizeMode(serviceType: string): "train" | "bus" {
  if (serviceType === "T") return "train";
  if (serviceType === "B") return "bus";
  // Stop/NextService captures have only shown "T" so far (issue #3); this is
  // a best-effort default per the tool-schemas spec §1.1 single-letter
  // enum-expansion pattern — revisit if another code is ever observed.
  return "bus";
}

function normalizeStatus(departureStatus: string): string {
  // Confirmed empirically (tool-schemas spec §5): E = expected (not yet
  // departed), A = actual (has departed). C never appeared live; "cancelled"
  // is the best-effort inference carried over from ticket 006/#3.
  if (departureStatus === "E") return "expected";
  if (departureStatus === "A") return "actual";
  if (departureStatus === "C") return "cancelled";
  return departureStatus;
}

function normalizeDeparture(line: RawNextServiceLine): Departure {
  const platform: Departure["platform"] = {};
  if (line.ScheduledPlatform) platform.scheduled = line.ScheduledPlatform;
  if (line.ActualPlatform) platform.actual = line.ActualPlatform;

  return {
    line_code: line.LineCode,
    line_name: line.LineName,
    direction: line.DirectionName.trim(),
    mode: normalizeMode(line.ServiceType),
    scheduled_time: toIsoWithTorontoOffset(line.ScheduledDepartureTime),
    expected_time: toIsoWithTorontoOffset(line.ComputedDepartureTime),
    delay_minutes: diffMinutes(
      line.ComputedDepartureTime,
      line.ScheduledDepartureTime,
    ),
    status: normalizeStatus(line.DepartureStatus),
    platform,
    trip_number: line.TripNumber,
  };
}

export function normalizeNextService(
  raw: RawNextServiceResponse,
): NextServiceResult {
  const departures = (raw.NextService?.Lines ?? []).map(normalizeDeparture);
  return {
    departures,
    truncated: false,
    total_matched: departures.length,
  };
}
