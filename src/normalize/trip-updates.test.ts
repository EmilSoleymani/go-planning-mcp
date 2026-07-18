import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import type { RawGtfsTripUpdatesResponse } from "../metrolinx/types.js";
import { normalizeTripUpdates } from "./trip-updates.js";

const fixture = JSON.parse(
  readFileSync(
    new URL("../../test/fixtures/gtfs-trip-updates.json", import.meta.url),
    "utf8",
  ),
) as RawGtfsTripUpdatesResponse;

describe("normalizeTripUpdates", () => {
  it("normalizes an on-time trip's identifiers, timestamps, and stop updates", () => {
    const result = normalizeTripUpdates(fixture, { trip_number: "1624" }, 20);

    expect(result.updates).toHaveLength(1);
    expect(result.updates[0]).toMatchObject({
      trip_number: "1624",
      line_code: "LW",
      status: "on_time",
      delay_minutes: 0,
      updated_at: "2026-07-17T16:46:43-04:00",
    });
    expect(result.updates[0]?.stop_updates).toEqual([
      {
        stop_code: "UN",
        expected_departure: "2026-07-17T16:48:00-04:00",
        scheduled_departure: "2026-07-17T16:48:00-04:00",
        status: "scheduled",
      },
    ]);
  });

  it("classifies a delay >= 3 minutes as delayed", () => {
    const result = normalizeTripUpdates(fixture, { trip_number: "41430" }, 20);
    expect(result.updates[0]).toMatchObject({
      line_code: "41",
      status: "delayed",
      delay_minutes: 28,
    });
  });

  it("classifies any skipped stop as modified, regardless of delay", () => {
    const result = normalizeTripUpdates(fixture, { trip_number: "19550" }, 20);
    expect(result.updates[0]?.status).toBe("modified");
    expect(
      result.updates[0]?.stop_updates.some((s) => s.status === "skipped"),
    ).toBe(true);
  });

  it("classifies a cancelled trip regardless of delay or skipped stops", () => {
    const result = normalizeTripUpdates(
      {
        header: {
          gtfs_realtime_version: "2.0",
          incrementality: "FULL_DATASET",
          timestamp: 0,
        },
        entity: [
          {
            id: "x",
            is_deleted: false,
            trip_update: {
              trip: {
                trip_id: "20260717-LW-9001",
                route_id: "06260926-LW",
                direction_id: 0,
                start_time: "10:00:00",
                start_date: "20260717",
                schedule_relationship: "CANCELED",
              },
              stop_time_update: [],
              timestamp: 0,
              delay: null,
            },
          },
        ],
      },
      {},
      20,
    );
    expect(result.updates[0]?.status).toBe("cancelled");
  });

  it("unfiltered call is disruptions-only: excludes on_time trips", () => {
    const result = normalizeTripUpdates(fixture, {}, 500);
    expect(result.updates.every((u) => u.status !== "on_time")).toBe(true);
    expect(result.updates.some((u) => u.trip_number === "1624")).toBe(false);
  });

  it("any filter includes on-time confirmations", () => {
    const result = normalizeTripUpdates(fixture, { trip_number: "41472" }, 20);
    expect(result.updates).toHaveLength(1);
    expect(result.updates[0]).toMatchObject({ status: "on_time" });
  });

  it("filters by line_code", () => {
    const result = normalizeTripUpdates(fixture, { line_code: "LW" }, 500);
    expect(result.updates.length).toBeGreaterThan(0);
    expect(result.updates.every((u) => u.line_code === "LW")).toBe(true);
  });

  it("filters by stop_code across a trip's stop_updates", () => {
    const result = normalizeTripUpdates(fixture, { stop_code: "UN" }, 500);
    expect(result.updates.length).toBeGreaterThan(0);
    expect(
      result.updates.every((u) =>
        u.stop_updates.some((s) => s.stop_code === "UN"),
      ),
    ).toBe(true);
  });

  it("caps results at limit and reports truncation", () => {
    const result = normalizeTripUpdates(fixture, {}, 2);
    expect(result.updates.length).toBeLessThanOrEqual(2);
    expect(result.truncated).toBe(result.total_matched! > 2);
  });
});
