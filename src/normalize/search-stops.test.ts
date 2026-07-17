import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import type { RawStopAllResponse } from "../metrolinx/types.js";
import { normalizeSearchStops } from "./search-stops.js";

const stopAll = JSON.parse(
  readFileSync(
    new URL("../../test/fixtures/stop-all.json", import.meta.url),
    "utf8",
  ),
) as RawStopAllResponse;

const ambiguous = JSON.parse(
  readFileSync(
    new URL(
      "../../test/fixtures/ambiguous-name-oakville.json",
      import.meta.url,
    ),
    "utf8",
  ),
) as RawStopAllResponse;

describe("normalizeSearchStops", () => {
  it("resolves a Train Station to its LocationCode", () => {
    const result = normalizeSearchStops(stopAll, "Union Station GO");
    expect(result.matches).toContainEqual({
      stop_code: "UN",
      stop_name: "Union Station GO",
      stop_type: "train",
    });
  });

  it("resolves a pure Bus Stop/Terminal to its PublicStopId", () => {
    const result = normalizeSearchStops(stopAll, "Union Station Bus Terminal");
    expect(result.matches).toContainEqual({
      stop_code: "102300",
      stop_name: "Union Station Bus Terminal",
      stop_type: "bus",
    });
  });

  it("returns both candidates for the ambiguous-name-oakville fixture, matcher-reproducible", () => {
    const result = normalizeSearchStops(ambiguous, "Oakville GO");

    expect(result.matches).toHaveLength(2);
    // The Bus Stop entry's unified stop_code is its 6-digit PublicStopId
    // (tool-schemas spec §1.4), not its 5-digit LocationCode.
    expect(new Set(result.matches.map((m) => m.stop_code))).toEqual(
      new Set(["100137", "OA"]),
    );
    expect(result.matches.find((m) => m.stop_code === "100137")).toMatchObject({
      stop_type: "bus",
    });
    expect(result.matches.find((m) => m.stop_code === "OA")).toMatchObject({
      stop_type: "both",
    });
  });

  it("ranks exact and prefix matches ahead of substring matches", () => {
    const result = normalizeSearchStops(stopAll, "union", "any", 25);
    const names = result.matches.map((m) => m.stop_name);

    const substringOnlyIndex = names.indexOf("Kingston Rd. @ Port Union Rd.");
    const prefixIndex = names.indexOf("Union Station GO");
    expect(prefixIndex).toBeGreaterThanOrEqual(0);
    expect(substringOnlyIndex).toBeGreaterThan(prefixIndex);
  });

  it("filters by stop_type, including 'both' stops in either filter", () => {
    const trainOnly = normalizeSearchStops(stopAll, "union", "train", 25);
    expect(
      trainOnly.matches.every(
        (m) => m.stop_type === "train" || m.stop_type === "both",
      ),
    ).toBe(true);
    expect(trainOnly.matches.map((m) => m.stop_name)).toContain(
      "Unionville GO",
    );
  });

  it("caps results at limit and reports truncation", () => {
    const result = normalizeSearchStops(stopAll, "GO", "any", 3);
    expect(result.matches).toHaveLength(3);
    expect(result.truncated).toBe(true);
    expect(result.total_matched).toBeGreaterThan(3);
  });

  it("returns no matches and truncated: false for a query with no hits", () => {
    const result = normalizeSearchStops(stopAll, "zzzznotarealstopzzzz");
    expect(result.matches).toEqual([]);
    expect(result.truncated).toBe(false);
    expect(result.total_matched).toBe(0);
  });
});
