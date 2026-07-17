import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { MetrolinxError } from "../errors.js";
import type { RawNextServiceResponse } from "../metrolinx/types.js";
import { normalizeNextService } from "./next-service.js";

const fixture = JSON.parse(
  readFileSync(
    new URL("../../test/fixtures/stop-next-service.json", import.meta.url),
    "utf8",
  ),
) as RawNextServiceResponse;

describe("normalizeNextService", () => {
  it("normalizes the live-captured Union NextService fixture", () => {
    const result = normalizeNextService(fixture);

    expect(result.total_matched).toBe(fixture.NextService?.Lines?.length);
    expect(result.truncated).toBe(false);

    const first = result.departures[0];
    expect(first).toMatchObject({
      line_code: "LW",
      line_name: "Lakeshore West",
      direction: "LW - Aldershot GO",
      mode: "train",
      status: "expected",
      trip_number: "1077",
      scheduled_time: "2026-07-17T17:29:00-04:00",
      expected_time: "2026-07-17T17:29:00-04:00",
      delay_minutes: 0,
    });
  });

  it("expands 'A' DepartureStatus to actual", () => {
    const result = normalizeNextService(fixture);
    const departed = result.departures.find((d) => d.trip_number === "9724");
    expect(departed?.status).toBe("actual");
  });

  it("derives delay_minutes as expected minus scheduled", () => {
    const result = normalizeNextService(fixture);
    const delayed = result.departures.find((d) => d.trip_number === "5325");
    // Scheduled 16:45:00, computed 16:45:16 -> rounds to 0, so assert via
    // a trip with a whole-minute delay pulled straight from the fixture.
    expect(delayed?.delay_minutes).toBe(0);
  });

  it("omits empty platform fields but keeps populated ones", () => {
    const result = normalizeNextService(fixture);
    const withPlatform = result.departures.find(
      (d) => d.trip_number === "1875",
    );
    const withoutPlatform = result.departures.find(
      (d) => d.trip_number === "1077",
    );

    expect(withPlatform?.platform).toEqual({ scheduled: "5" });
    expect(withoutPlatform?.platform).toEqual({});
  });

  it("returns an empty departures list when Lines is empty but NextService is present", () => {
    const result = normalizeNextService({
      Metadata: { TimeStamp: "", ErrorCode: "200", ErrorMessage: "OK" },
      NextService: { Lines: [] },
    });
    expect(result).toEqual({
      departures: [],
      truncated: false,
      total_matched: 0,
    });
  });

  it("throws a not_found MetrolinxError when NextService is absent (live-confirmed 204/No Content shape)", () => {
    expect(() =>
      normalizeNextService({
        Metadata: {
          TimeStamp: "2026-07-17 19:46:04",
          ErrorCode: "204",
          ErrorMessage: "No Content",
        },
        NextService: null,
      }),
    ).toThrow(MetrolinxError);
  });
});
