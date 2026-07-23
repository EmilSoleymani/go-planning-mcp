import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import type { RawStopAllResponse } from "../metrolinx/types.js";
import {
  buildStopNameIndex,
  normalizeSearchStops,
  resolveStopByName,
  resolveWireCode,
} from "./search-stops.js";

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

describe("buildStopNameIndex", () => {
  it("indexes every stop by its unified stop_code", () => {
    const index = buildStopNameIndex(stopAll);
    expect(index.get("UN")).toBe("Union Station GO");
  });

  it("indexes both entries of an ambiguous name collision separately", () => {
    const index = buildStopNameIndex(ambiguous);
    expect(index.get("OA")).toBe("Oakville GO");
    expect(index.get("100137")).toBe("Oakville GO");
  });
});

describe("resolveStopByName", () => {
  it("resolves an unambiguous name to its unified stop_code", () => {
    const result = resolveStopByName(stopAll, "Union Station GO");
    expect(result).toEqual({
      status: "resolved",
      match: {
        stop_code: "UN",
        stop_name: "Union Station GO",
        stop_type: "train",
      },
      wireCode: "UN",
    });
  });

  // Confirmed live (2026-07-21, issue #35 verification): Schedule/Journey
  // and Stop/Details speak LocationCode ("02816"), and return empty/204 for
  // the unified 6-digit PublicStopId ("102816") that bus-only stops carry
  // as their public stop_code. Resolution must surface both.
  it("carries the wire LocationCode for a bus-only stop alongside its unified code", () => {
    const result = resolveStopByName(stopAll, "102816");
    expect(result).toMatchObject({
      status: "resolved",
      match: { stop_code: "102816", stop_type: "bus" },
      wireCode: "02816",
    });
  });

  it("resolves an exact stop code without fuzzy-matching its name", () => {
    const result = resolveStopByName(stopAll, "UN");
    expect(result).toMatchObject({
      status: "resolved",
      match: { stop_code: "UN" },
    });
  });

  it("resolves a stop code case-insensitively", () => {
    const result = resolveStopByName(stopAll, "un");
    expect(result).toMatchObject({
      status: "resolved",
      match: { stop_code: "UN" },
    });
  });

  it("returns ambiguous with both candidates for the Oakville GO name collision, reproducible via search_stops", () => {
    const result = resolveStopByName(ambiguous, "Oakville GO");
    expect(result.status).toBe("ambiguous");
    if (result.status !== "ambiguous") throw new Error("expected ambiguous");
    expect(new Set(result.candidates.map((c) => c.stop_code))).toEqual(
      new Set(["100137", "OA"]),
    );

    const searchStopsResult = normalizeSearchStops(ambiguous, "Oakville GO");
    expect(new Set(result.candidates.map((c) => c.stop_code))).toEqual(
      new Set(searchStopsResult.matches.map((m) => m.stop_code)),
    );
  });

  it("returns not_found for a query with no hits", () => {
    const result = resolveStopByName(stopAll, "zzzznotarealstopzzzz");
    expect(result).toEqual({ status: "not_found" });
  });
});

describe("resolveWireCode", () => {
  it("resolves a bus stop's unified PublicStopId to its LocationCode", () => {
    const result = resolveWireCode(stopAll, "102300");
    expect(result).toEqual({ wireCode: "02300", stopCode: "102300" });
  });

  it("resolves case-insensitively and canonicalizes the returned stopCode", () => {
    const result = resolveWireCode(stopAll, "un");
    expect(result).toEqual({ wireCode: "UN", stopCode: "UN" });
  });

  it("is identical to stop_code for a train station (wireCode === stop_code)", () => {
    const result = resolveWireCode(stopAll, "UN");
    expect(result?.wireCode).toBe(result?.stopCode);
  });

  it("does not fuzzy-match by name — only an exact unified stop_code resolves", () => {
    // "Union" is a valid name-search query (resolveStopByName would fuzzy
    // match it) but not itself anyone's unified stop_code — these tools
    // promise exact-code-only resolution (issue #61).
    const result = resolveWireCode(stopAll, "Union");
    expect(result).toBeUndefined();
  });

  it("returns undefined for a code that matches no stop", () => {
    const result = resolveWireCode(stopAll, "zzzznotarealcodezzzz");
    expect(result).toBeUndefined();
  });
});
