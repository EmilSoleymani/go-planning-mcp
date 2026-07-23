import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { MetrolinxError } from "../errors.js";
import type {
  RawNextServiceResponse,
  RawStopAllResponse,
} from "../metrolinx/types.js";
import { callTool, fakeClient } from "./test-support.js";

const fixture = JSON.parse(
  readFileSync(
    new URL("../../test/fixtures/stop-next-service.json", import.meta.url),
    "utf8",
  ),
) as RawNextServiceResponse;

const stopAll = JSON.parse(
  readFileSync(
    new URL("../../test/fixtures/stop-all.json", import.meta.url),
    "utf8",
  ),
) as RawStopAllResponse;

describe("get_next_service", () => {
  it("returns normalized departures as structuredContent", async () => {
    const result = await callTool(
      fakeClient({
        getStopAll: () => Promise.resolve(stopAll),
        getNextService: () => Promise.resolve(fixture),
      }),
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
        getStopAll: () => Promise.resolve(stopAll),
        getNextService: () =>
          Promise.reject(new MetrolinxError("rate_limited", "wait", false)),
      }),
      "get_next_service",
      { stop_code: "UN" },
    );

    expect(result.isError).toBe(true);
    expect(result.errorPayload?.error.code).toBe("rate_limited");
  });

  it("returns an in-result not_found error for a stop code absent from Stop/All", async () => {
    const result = await callTool(
      fakeClient({ getStopAll: () => Promise.resolve(stopAll) }),
      "get_next_service",
      { stop_code: "NOPE" },
    );

    expect(result.isError).toBe(true);
    expect(result.errorPayload?.error.code).toBe("not_found");
    expect(result.errorPayload?.error.message).toContain("search_stops");
  });

  // Confirmed live for Stop/Details and Schedule/Journey (issue #35);
  // get_next_service inherits the same code-space gap (issue #61) — this
  // covers the translation defensively even though live re-verification of
  // this specific endpoint is still outstanding.
  it("translates a bus stop's unified stop_code to its LocationCode upstream", async () => {
    let capturedCode: string | undefined;
    const result = await callTool(
      fakeClient({
        getStopAll: () => Promise.resolve(stopAll),
        getNextService: (code) => {
          capturedCode = code;
          return Promise.resolve(fixture);
        },
      }),
      "get_next_service",
      { stop_code: "102300" },
    );

    expect(capturedCode).toBe("02300");
    expect(result.isError).toBe(false);
  });
});
