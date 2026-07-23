import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { MetrolinxError } from "../errors.js";
import type {
  RawStopAllResponse,
  RawStopDetailsResponse,
} from "../metrolinx/types.js";
import { callTool, fakeClient } from "./test-support.js";

const fixture = JSON.parse(
  readFileSync(
    new URL("../../test/fixtures/stop-details.json", import.meta.url),
    "utf8",
  ),
) as RawStopDetailsResponse;

const stopAll = JSON.parse(
  readFileSync(
    new URL("../../test/fixtures/stop-all.json", import.meta.url),
    "utf8",
  ),
) as RawStopAllResponse;

describe("get_stop_details", () => {
  it("returns the normalized DTO as structuredContent (live-captured Union fixture)", async () => {
    const result = await callTool(
      fakeClient({
        getStopAll: () => Promise.resolve(stopAll),
        getStopDetails: () => Promise.resolve(fixture),
      }),
      "get_stop_details",
      { stop_code: "UN" },
    );

    expect(result.isError).toBe(false);
    expect(result.structuredContent).toMatchObject({
      stop_code: "UN",
      stop_name: "Union Station GO",
      city: "Toronto",
      coordinates: { lat: 43.645195, lon: -79.3806 },
      // Confirmed live: this Stop/Details entry reports IsBus: false — GO
      // bus boarding at Union is tracked separately (see boarding_info).
      served_by: { train: true, bus: false },
      parking: [],
      accessibility_info:
        "Wheelchair Accessible Train Service; Upexpress Wheelchair Accessible Train Service",
      boarding_info:
        "GO Buses board at Union Station GO Bus Terminal on the east side of Bay Street at Lake Shore Blvd.",
    });
    expect(result.structuredContent).toHaveProperty(
      "facilities",
      expect.arrayContaining(["Wi-Fi", "Waiting Room", "Bicycle Rack"]),
    );
  });

  it("collapses to French facility descriptions when lang: fr is requested", async () => {
    const result = await callTool(
      fakeClient({
        getStopAll: () => Promise.resolve(stopAll),
        getStopDetails: () => Promise.resolve(fixture),
      }),
      "get_stop_details",
      { stop_code: "UN", lang: "fr" },
    );

    expect(result.isError).toBe(false);
    // StopNameFr is empty upstream — falls back to English.
    expect(result.structuredContent).toMatchObject({
      stop_name: "Union Station GO",
    });
    expect(result.structuredContent).toHaveProperty(
      "facilities",
      expect.arrayContaining(["Ascenseurs", "Wi-Fi"]),
    );
  });

  it("returns an in-result not_found error for a stop code absent from Stop/All", async () => {
    const result = await callTool(
      fakeClient({ getStopAll: () => Promise.resolve(stopAll) }),
      "get_stop_details",
      { stop_code: "NOPE" },
    );

    expect(result.isError).toBe(true);
    expect(result.errorPayload?.error.code).toBe("not_found");
    expect(result.errorPayload?.error.message).toContain("search_stops");
  });

  // Confirmed live (2026-07-21, issue #35/#61): a pure bus stop's unified
  // stop_code is its 6-digit PublicStopId, but Stop/Details only accepts
  // its LocationCode — the tool must translate before calling upstream and
  // echo back the unified code, not the wire code Stop/Details itself sees.
  it("translates a bus stop's unified stop_code to its LocationCode upstream and echoes the unified code back", async () => {
    let capturedCode: string | undefined;
    const busStopDetails: RawStopDetailsResponse = {
      Metadata: { TimeStamp: "", ErrorCode: "200", ErrorMessage: "OK" },
      Stop: {
        Code: "02300",
        StopName: "Union Station Bus Terminal",
        StopNameFr: "",
        City: "Toronto",
        Latitude: "43.645",
        Longitude: "-79.380",
        IsBus: true,
        IsTrain: false,
        Facilities: [],
        Parkings: [],
        BoardingInfo: "",
        BoardingInfoFr: "",
        DrivingDirections: "",
        DrivingDirectionsFr: "",
      },
    };
    const result = await callTool(
      fakeClient({
        getStopAll: () => Promise.resolve(stopAll),
        getStopDetails: (code) => {
          capturedCode = code;
          return Promise.resolve(busStopDetails);
        },
      }),
      "get_stop_details",
      { stop_code: "102300" },
    );

    expect(capturedCode).toBe("02300");
    expect(result.isError).toBe(false);
    expect(result.structuredContent).toMatchObject({ stop_code: "102300" });
  });

  it("surfaces client failures through the error taxonomy", async () => {
    const result = await callTool(
      fakeClient({
        getStopAll: () => Promise.resolve(stopAll),
        getStopDetails: () =>
          Promise.reject(
            new MetrolinxError(
              "rate_limited",
              "Metrolinx rate limit hit. Do not retry now.",
              false,
            ),
          ),
      }),
      "get_stop_details",
      { stop_code: "UN" },
    );

    expect(result.isError).toBe(true);
    expect(result.errorPayload?.error).toMatchObject({
      code: "rate_limited",
      retryable: false,
    });
  });
});
