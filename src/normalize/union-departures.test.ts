import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import type {
  RawStopAllResponse,
  RawUnionDeparturesResponse,
} from "../metrolinx/types.js";
import { normalizeUnionDepartures } from "./union-departures.js";

const fixture = JSON.parse(
  readFileSync(
    new URL("../../test/fixtures/union-departures.json", import.meta.url),
    "utf8",
  ),
) as RawUnionDeparturesResponse;

const stopAll = JSON.parse(
  readFileSync(
    new URL("../../test/fixtures/stop-all.json", import.meta.url),
    "utf8",
  ),
) as RawStopAllResponse;

describe("normalizeUnionDepartures", () => {
  it("normalizes the live-captured departure board, resolving stop codes via the fuzzy matcher", () => {
    const result = normalizeUnionDepartures(fixture, stopAll);
    const first = result.departures[0];

    expect(first).toMatchObject({
      trip_number: "1029",
      mode: "train",
      service: "Lakeshore West",
      time: "2026-07-17T18:17:00-04:00",
    });
    expect(first?.platform).toBeUndefined();
    expect(first?.stops_served[0]).toEqual({
      stop_code: "EX",
      stop_name: "Exhibition",
    });
    expect(result.total_matched).toBe(fixture.AllDepartures?.Trip?.length);
  });

  it("omits the '-' placeholder platform but keeps a real one", () => {
    const result = normalizeUnionDepartures(fixture, stopAll);
    const withPlatform = result.departures.find(
      (d) => d.trip_number === "1875",
    );
    expect(withPlatform?.platform).toBe("5 & 6");
  });

  it("filters by mode", () => {
    // The captured fixture is entirely ServiceType "T" (train).
    const result = normalizeUnionDepartures(fixture, stopAll, "bus");
    expect(result.departures).toEqual([]);
    expect(result.total_matched).toBe(0);
  });

  it("falls back to an empty stop_code when no fuzzy match is found", () => {
    const result = normalizeUnionDepartures(
      {
        Metadata: { TimeStamp: "", ErrorCode: "200", ErrorMessage: "OK" },
        AllDepartures: {
          Trip: [
            {
              Info: "",
              TripNumber: "1",
              Platform: "-",
              Service: "Nowhere Line",
              ServiceType: "T",
              Time: "2026-07-17 10:00:00",
              Stops: [{ Name: "Nonexistent Place", Code: null }],
            },
          ],
        },
      },
      { Metadata: { TimeStamp: "", ErrorCode: "200", ErrorMessage: "OK" } },
    );
    expect(result.departures[0]?.stops_served[0]).toEqual({
      stop_code: "",
      stop_name: "Nonexistent Place",
    });
  });
});
