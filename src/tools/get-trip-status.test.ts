import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { MetrolinxError } from "../errors.js";
import type {
  RawStopAllResponse,
  RawTripStatusResponse,
} from "../metrolinx/types.js";
import { callTool, fakeClient } from "./test-support.js";

const tripFixture = JSON.parse(
  readFileSync(
    new URL("../../test/fixtures/schedule-trip.json", import.meta.url),
    "utf8",
  ),
) as RawTripStatusResponse;

const stopAllFixture = JSON.parse(
  readFileSync(
    new URL("../../test/fixtures/stop-all.json", import.meta.url),
    "utf8",
  ),
) as RawStopAllResponse;

describe("get_trip_status", () => {
  it("returns normalized stop-by-stop status as structuredContent", async () => {
    let capturedArgs: [string, string] | undefined;
    const result = await callTool(
      fakeClient({
        getTripStatus: (dateWire, tripNumber) => {
          capturedArgs = [dateWire, tripNumber];
          return Promise.resolve(tripFixture);
        },
        getStopAll: () => Promise.resolve(stopAllFixture),
      }),
      "get_trip_status",
      { trip_number: "1004", date: "2026-07-17" },
    );

    expect(result.isError).toBe(false);
    expect(capturedArgs).toEqual(["20260717", "1004"]);
    expect(result.structuredContent).toMatchObject({
      trip_number: "1004",
      destination: "Union Station",
      status: "En Route",
    });
    const structured = result.structuredContent as {
      stops: { stop_code: string; stop_name: string }[];
    };
    expect(structured.stops.find((s) => s.stop_code === "AL")?.stop_name).toBe(
      "Aldershot GO",
    );
  });

  it("returns a not_found error for an unknown trip number", async () => {
    const result = await callTool(
      fakeClient({
        getTripStatus: () =>
          Promise.resolve({
            Metadata: {
              TimeStamp: "",
              ErrorCode: "204",
              ErrorMessage: "No Content",
            },
            Trips: null,
          }),
        getStopAll: () => Promise.resolve(stopAllFixture),
      }),
      "get_trip_status",
      { trip_number: "NOPE" },
    );

    expect(result.isError).toBe(true);
    expect(result.errorPayload?.error.code).toBe("not_found");
  });

  it("surfaces client failures through the error taxonomy", async () => {
    const result = await callTool(
      fakeClient({
        getTripStatus: () =>
          Promise.reject(new MetrolinxError("rate_limited", "wait", false)),
        getStopAll: () => Promise.resolve(stopAllFixture),
      }),
      "get_trip_status",
      { trip_number: "1004" },
    );

    expect(result.isError).toBe(true);
    expect(result.errorPayload?.error.code).toBe("rate_limited");
  });
});
