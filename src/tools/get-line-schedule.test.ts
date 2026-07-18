import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { MetrolinxError } from "../errors.js";
import type { RawLineScheduleResponse } from "../metrolinx/types.js";
import { callTool, fakeClient } from "./test-support.js";

const fixture = JSON.parse(
  readFileSync(
    new URL("../../test/fixtures/schedule-line.json", import.meta.url),
    "utf8",
  ),
) as RawLineScheduleResponse;

describe("get_line_schedule", () => {
  it("without stop_code returns trip summaries, never full trip x stop dumps", async () => {
    let capturedArgs: [string, string, string] | undefined;
    const result = await callTool(
      fakeClient({
        getLineSchedule: (dateWire, lineCode, direction) => {
          capturedArgs = [dateWire, lineCode, direction];
          return Promise.resolve(fixture);
        },
      }),
      "get_line_schedule",
      { line_code: "LW", direction: "E", date: "2026-07-17" },
    );

    expect(result.isError).toBe(false);
    expect(capturedArgs).toEqual(["20260717", "LW", "E"]);
    const structured = result.structuredContent as {
      trips: {
        trip_number: string;
        departs_first_stop?: string;
        time?: string;
      }[];
    };
    const trip1004 = structured.trips.find((t) => t.trip_number === "1004");
    expect(trip1004?.departs_first_stop).toBe("2026-07-17T04:52:00-04:00");
    expect(trip1004?.time).toBeUndefined();
  });

  it("with stop_code returns only that stop's time per trip", async () => {
    const result = await callTool(
      fakeClient({ getLineSchedule: () => Promise.resolve(fixture) }),
      "get_line_schedule",
      { line_code: "LW", direction: "E", stop_code: "UN" },
    );

    const structured = result.structuredContent as {
      trips: {
        trip_number: string;
        time?: string;
        departs_first_stop?: string;
      }[];
    };
    expect(structured.trips.length).toBeGreaterThan(0);
    expect(structured.trips[0]?.time).toBeDefined();
    expect(structured.trips[0]?.departs_first_stop).toBeUndefined();
  });

  it("returns a not_found error for an unknown line/direction", async () => {
    const result = await callTool(
      fakeClient({
        getLineSchedule: () =>
          Promise.resolve({
            Metadata: { TimeStamp: "", ErrorCode: "200", ErrorMessage: "OK" },
            Lines: { Line: [] },
          }),
      }),
      "get_line_schedule",
      { line_code: "NOPE", direction: "E" },
    );

    expect(result.isError).toBe(true);
    expect(result.errorPayload?.error.code).toBe("not_found");
  });

  it("surfaces client failures through the error taxonomy", async () => {
    const result = await callTool(
      fakeClient({
        getLineSchedule: () =>
          Promise.reject(new MetrolinxError("rate_limited", "wait", false)),
      }),
      "get_line_schedule",
      { line_code: "LW", direction: "E" },
    );

    expect(result.isError).toBe(true);
    expect(result.errorPayload?.error.code).toBe("rate_limited");
  });
});
