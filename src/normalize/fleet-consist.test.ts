import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import type { RawFleetConsistResponse } from "../metrolinx/types.js";
import {
  findConsistByTrip,
  firstConsist,
  normalizeFleetConsist,
} from "./fleet-consist.js";

const allFixture = JSON.parse(
  readFileSync(
    new URL("../../test/fixtures/fleet-consist.json", import.meta.url),
    "utf8",
  ),
) as RawFleetConsistResponse;

const engineFixture = JSON.parse(
  readFileSync(
    new URL("../../test/fixtures/fleet-consist-engine.json", import.meta.url),
    "utf8",
  ),
) as RawFleetConsistResponse;

describe("findConsistByTrip", () => {
  it("finds the consist whose RemainingTrip list contains the given trip number", () => {
    const consist = findConsistByTrip(allFixture, "2011");
    expect(consist?.EngineNumber).toBe("651");
  });

  it("returns undefined for an unknown trip number", () => {
    expect(findConsistByTrip(allFixture, "nope")).toBeUndefined();
  });
});

describe("firstConsist", () => {
  it("returns the single consist from an engine-filtered response", () => {
    const consist = firstConsist(engineFixture);
    expect(consist?.EngineNumber).toBe("651");
  });

  it("returns undefined when Consists is absent", () => {
    expect(
      firstConsist({
        Metadata: { TimeStamp: "", ErrorCode: "200", ErrorMessage: "OK" },
        AllConsists: null,
      }),
    ).toBeUndefined();
  });
});

describe("normalizeFleetConsist", () => {
  it("maps engine, coach count, ordered cars, and remaining trips", () => {
    const consist = findConsistByTrip(allFixture, "1234");
    if (!consist) throw new Error("fixture missing expected consist");

    const result = normalizeFleetConsist(consist);

    expect(result).toEqual({
      engine_number: "639",
      coach_count: 3,
      cars: [
        { type: "Cab Car", order: 1, number: "301" },
        { type: "Coach", order: 2, number: "302" },
        { type: "Locomotive", order: 3, number: "639" },
      ],
      remaining_trips: [
        {
          trip_number: "1234",
          line: "LW",
          start_time: "16:45",
          end_time: "17:50",
        },
        {
          trip_number: "1236",
          line: "LW",
          start_time: "18:15",
          end_time: "19:20",
        },
      ],
    });
  });
});
