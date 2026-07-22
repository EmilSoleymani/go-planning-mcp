import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import type {
  RawStopAllResponse,
  RawStopDestinationsResponse,
} from "../metrolinx/types.js";
import { callTool, fakeClient } from "./test-support.js";

const fixture = JSON.parse(
  readFileSync(
    new URL("../../test/fixtures/stop-destinations.json", import.meta.url),
    "utf8",
  ),
) as RawStopDestinationsResponse;

const stopAll = JSON.parse(
  readFileSync(
    new URL("../../test/fixtures/stop-all.json", import.meta.url),
    "utf8",
  ),
) as RawStopAllResponse;

describe("get_stop_destinations", () => {
  it("returns normalized, deduped destinations as structuredContent", async () => {
    let capturedArgs: [string, string, string] | undefined;
    const result = await callTool(
      fakeClient({
        getStopAll: () => Promise.resolve(stopAll),
        getStopDestinations: (stopCode, fromTime, toTime) => {
          capturedArgs = [stopCode, fromTime, toTime];
          return Promise.resolve(fixture);
        },
      }),
      "get_stop_destinations",
      { stop_code: "UN", from_time: "09:00", to_time: "13:00" },
    );

    expect(result.isError).toBe(false);
    expect(capturedArgs).toEqual(["UN", "0900", "1300"]);
    expect(result.structuredContent).toMatchObject({
      destinations: expect.arrayContaining([
        {
          line_code: "BR",
          line_name: "Barrie",
          direction: "N",
          destination_stop_code: "AD",
          destination_stop_name: "Allandale Waterfront GO",
        },
      ]) as unknown,
    });
  });

  it("defaults from_time/to_time to now -> now+4h in Toronto wire format", async () => {
    let capturedArgs: [string, string, string] | undefined;
    await callTool(
      fakeClient({
        getStopAll: () => Promise.resolve(stopAll),
        getStopDestinations: (stopCode, fromTime, toTime) => {
          capturedArgs = [stopCode, fromTime, toTime];
          return Promise.resolve(fixture);
        },
      }),
      "get_stop_destinations",
      { stop_code: "UN" },
    );

    expect(capturedArgs?.[0]).toBe("UN");
    expect(capturedArgs?.[1]).toMatch(/^\d{4}$/);
    expect(capturedArgs?.[2]).toMatch(/^\d{4}$/);
  });

  it("returns a not_found error for a stop code absent from Stop/All", async () => {
    const result = await callTool(
      fakeClient({ getStopAll: () => Promise.resolve(stopAll) }),
      "get_stop_destinations",
      { stop_code: "NOPE" },
    );

    expect(result.isError).toBe(true);
    expect(result.errorPayload?.error.code).toBe("not_found");
  });

  // Confirmed live for Stop/Details and Schedule/Journey (issue #35);
  // get_stop_destinations inherits the same code-space gap (issue #61) —
  // covered defensively even though live re-verification of this specific
  // endpoint is still outstanding.
  it("translates a bus stop's unified stop_code to its LocationCode upstream", async () => {
    let capturedCode: string | undefined;
    const result = await callTool(
      fakeClient({
        getStopAll: () => Promise.resolve(stopAll),
        getStopDestinations: (stopCode) => {
          capturedCode = stopCode;
          return Promise.resolve(fixture);
        },
      }),
      "get_stop_destinations",
      { stop_code: "102300" },
    );

    expect(capturedCode).toBe("02300");
    expect(result.isError).toBe(false);
  });
});
