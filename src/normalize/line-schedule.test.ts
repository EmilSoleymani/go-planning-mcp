import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { MetrolinxError } from "../errors.js";
import type { RawLineScheduleResponse } from "../metrolinx/types.js";
import { normalizeLineSchedule } from "./line-schedule.js";

const fixture = JSON.parse(
  readFileSync(
    new URL("../../test/fixtures/schedule-line.json", import.meta.url),
    "utf8",
  ),
) as RawLineScheduleResponse;

describe("normalizeLineSchedule", () => {
  it("without stop_code returns trip summaries with first/last stop times", () => {
    const result = normalizeLineSchedule(fixture);

    expect(result.truncated).toBe(false);
    expect(result.total_matched).toBe(result.trips.length);

    const trip1004 = result.trips.find((t) => t.trip_number === "1004");
    expect(trip1004).toEqual({
      trip_number: "1004",
      display: "LW - Union Station",
      departs_first_stop: "2026-07-17T04:52:00-04:00",
      arrives_last_stop: "2026-07-17T06:00:00-04:00",
    });
  });

  it("with stop_code returns only the time at that stop, one entry per serving trip", () => {
    const result = normalizeLineSchedule(fixture, "UN");

    expect(result.trips.length).toBeGreaterThan(0);
    const trip1004 = result.trips.find((t) => t.trip_number === "1004");
    expect(trip1004).toEqual({
      trip_number: "1004",
      display: "LW - Union Station",
      time: "2026-07-17T06:00:00-04:00",
    });
  });

  it("normalizes a past-midnight service-day time onto the correct calendar date", () => {
    const result = normalizeLineSchedule(fixture, "UN");
    const lateTrip = result.trips.find((t) => t.trip_number === "1040");
    expect(lateTrip?.time).toBe("2026-07-18T00:15:00-04:00");
  });

  it("excludes trips that don't serve the requested stop_code", () => {
    const result = normalizeLineSchedule(fixture, "NOPE");
    expect(result.trips).toEqual([]);
  });

  it("throws a not_found MetrolinxError when no line/direction entry matches", () => {
    expect(() =>
      normalizeLineSchedule({
        Metadata: { TimeStamp: "", ErrorCode: "200", ErrorMessage: "OK" },
        Lines: { Line: [] },
      }),
    ).toThrow(MetrolinxError);
  });
});
