import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { MetrolinxError } from "../errors.js";
import type { RawGtfsTripUpdatesResponse } from "../metrolinx/types.js";
import { callTool, fakeClient } from "./test-support.js";

const fixture = JSON.parse(
  readFileSync(
    new URL("../../test/fixtures/gtfs-trip-updates.json", import.meta.url),
    "utf8",
  ),
) as RawGtfsTripUpdatesResponse;

describe("get_trip_updates", () => {
  it("unfiltered call returns only disruptions as structuredContent", async () => {
    const result = await callTool(
      fakeClient({ getTripUpdates: () => Promise.resolve(fixture) }),
      "get_trip_updates",
      {},
    );

    expect(result.isError).toBe(false);
    const structured = result.structuredContent as {
      updates: { status: string }[];
    };
    expect(structured.updates.length).toBeGreaterThan(0);
    expect(structured.updates.every((u) => u.status !== "on_time")).toBe(true);
  });

  it("with a filter, includes on-time confirmations", async () => {
    const result = await callTool(
      fakeClient({ getTripUpdates: () => Promise.resolve(fixture) }),
      "get_trip_updates",
      { trip_number: "41472" },
    );

    const structured = result.structuredContent as {
      updates: { status: string; trip_number: string }[];
    };
    expect(structured.updates).toEqual([
      expect.objectContaining({ trip_number: "41472", status: "on_time" }),
    ]);
  });

  it("surfaces client failures through the error taxonomy", async () => {
    const result = await callTool(
      fakeClient({
        getTripUpdates: () =>
          Promise.reject(new MetrolinxError("rate_limited", "wait", false)),
      }),
      "get_trip_updates",
      {},
    );

    expect(result.isError).toBe(true);
    expect(result.errorPayload?.error.code).toBe("rate_limited");
  });
});
