import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import type { RawServiceExceptionsResponse } from "../metrolinx/types.js";
import { normalizeServiceExceptions } from "./service-exceptions.js";

const fixture = JSON.parse(
  readFileSync(
    new URL("../../test/fixtures/service-exceptions.json", import.meta.url),
    "utf8",
  ),
) as RawServiceExceptionsResponse;

describe("normalizeServiceExceptions", () => {
  it("filters affected_stops down to cancelled/overridden stops only", () => {
    const result = normalizeServiceExceptions(fixture);
    const trip = result.exceptions.find((e) => e.trip_number === "9724");

    expect(trip?.cancelled).toBe(false);
    // 3 raw stops, only 2 flagged IsCancelled/IsOverride.
    expect(trip?.affected_stops).toHaveLength(2);
    expect(trip?.affected_stops.map((s) => s.stop_code)).toEqual(["OA", "AL"]);
  });

  it("prefers scheduled departure, falling back to arrival when departure is null", () => {
    const result = normalizeServiceExceptions(fixture);
    const trip = result.exceptions.find((e) => e.trip_number === "9724");
    const oakville = trip?.affected_stops.find((s) => s.stop_code === "OA");
    const aldershot = trip?.affected_stops.find((s) => s.stop_code === "AL");

    expect(oakville?.scheduled_time).toBe("2026-07-17T17:47:00-04:00");
    expect(aldershot?.scheduled_time).toBe("2026-07-17T18:10:00-04:00");
  });

  it("includes actual_time only when present", () => {
    const result = normalizeServiceExceptions(fixture);
    const trip = result.exceptions.find((e) => e.trip_number === "9724");
    const oakville = trip?.affected_stops.find((s) => s.stop_code === "OA");
    const aldershot = trip?.affected_stops.find((s) => s.stop_code === "AL");

    expect(oakville?.actual_time).toBeUndefined();
    expect(aldershot?.actual_time).toBe("2026-07-17T18:15:00-04:00");
  });

  it("marks a fully cancelled trip and all its affected stops cancelled", () => {
    const result = normalizeServiceExceptions(fixture);
    const trip = result.exceptions.find((e) => e.trip_number === "9999");

    expect(trip?.cancelled).toBe(true);
    expect(trip?.affected_stops.every((s) => s.cancelled)).toBe(true);
  });

  it("returns an empty exceptions list when Trip is absent", () => {
    const result = normalizeServiceExceptions({
      Metadata: { TimeStamp: "", ErrorCode: "200", ErrorMessage: "OK" },
      Trip: null,
    });
    expect(result).toEqual({
      exceptions: [],
      truncated: false,
      total_matched: 0,
    });
  });
});
