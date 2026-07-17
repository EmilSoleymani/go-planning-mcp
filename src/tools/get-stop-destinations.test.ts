import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import type { RawStopDestinationsResponse } from "../metrolinx/types.js";
import { callTool, fakeClient } from "./test-support.js";

const fixture = JSON.parse(
  readFileSync(
    new URL("../../test/fixtures/stop-destinations.json", import.meta.url),
    "utf8",
  ),
) as RawStopDestinationsResponse;

describe("get_stop_destinations", () => {
  it("returns normalized, deduped destinations as structuredContent", async () => {
    let capturedArgs: [string, string, string] | undefined;
    const result = await callTool(
      fakeClient({
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

  it("returns a not_found error when the stop code is unknown", async () => {
    const result = await callTool(
      fakeClient({
        getStopDestinations: () =>
          Promise.resolve({
            Metadata: { TimeStamp: "", ErrorCode: "200", ErrorMessage: "OK" },
            Stop: null,
          }),
      }),
      "get_stop_destinations",
      { stop_code: "NOPE" },
    );

    expect(result.isError).toBe(true);
    expect(result.errorPayload?.error.code).toBe("not_found");
  });
});
