import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { MetrolinxError } from "../errors.js";
import type { RawNextServiceResponse } from "../metrolinx/types.js";
import { callTool, fakeClient } from "./test-support.js";

const fixture = JSON.parse(
  readFileSync(
    new URL("../../test/fixtures/stop-next-service.json", import.meta.url),
    "utf8",
  ),
) as RawNextServiceResponse;

describe("get_next_service", () => {
  it("returns normalized departures as structuredContent", async () => {
    const result = await callTool(
      fakeClient({ getNextService: () => Promise.resolve(fixture) }),
      "get_next_service",
      { stop_code: "UN" },
    );

    expect(result.isError).toBe(false);
    const structured = result.structuredContent as {
      departures: {
        trip_number: string;
        status: string;
        delay_minutes: number;
      }[];
    };
    expect(structured.departures.length).toBeGreaterThan(0);
    expect(structured.departures[0]).toMatchObject({
      trip_number: "1077",
      status: "expected",
      delay_minutes: 0,
    });
  });

  it("surfaces client failures through the error taxonomy", async () => {
    const result = await callTool(
      fakeClient({
        getNextService: () =>
          Promise.reject(new MetrolinxError("rate_limited", "wait", false)),
      }),
      "get_next_service",
      { stop_code: "UN" },
    );

    expect(result.isError).toBe(true);
    expect(result.errorPayload?.error.code).toBe("rate_limited");
  });
});
