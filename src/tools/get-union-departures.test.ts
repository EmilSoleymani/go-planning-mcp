import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { MetrolinxError } from "../errors.js";
import type {
  RawStopAllResponse,
  RawUnionDeparturesResponse,
} from "../metrolinx/types.js";
import { callTool, fakeClient } from "./test-support.js";

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

describe("get_union_departures", () => {
  it("returns normalized departures as structuredContent", async () => {
    const result = await callTool(
      fakeClient({
        getUnionDepartures: () => Promise.resolve(fixture),
        getStopAll: () => Promise.resolve(stopAll),
      }),
      "get_union_departures",
      {},
    );

    expect(result.isError).toBe(false);
    const structured = result.structuredContent as {
      departures: { trip_number: string; mode: string }[];
    };
    expect(structured.departures.length).toBeGreaterThan(0);
    expect(structured.departures[0]).toMatchObject({
      trip_number: "1029",
      mode: "train",
    });
  });

  it("filters by mode", async () => {
    const result = await callTool(
      fakeClient({
        getUnionDepartures: () => Promise.resolve(fixture),
        getStopAll: () => Promise.resolve(stopAll),
      }),
      "get_union_departures",
      { mode: "bus" },
    );

    const structured = result.structuredContent as { departures: unknown[] };
    expect(structured.departures).toEqual([]);
  });

  it("surfaces client failures through the error taxonomy", async () => {
    const result = await callTool(
      fakeClient({
        getUnionDepartures: () =>
          Promise.reject(new MetrolinxError("rate_limited", "wait", false)),
        getStopAll: () => Promise.resolve(stopAll),
      }),
      "get_union_departures",
      {},
    );

    expect(result.isError).toBe(true);
    expect(result.errorPayload?.error.code).toBe("rate_limited");
  });
});
