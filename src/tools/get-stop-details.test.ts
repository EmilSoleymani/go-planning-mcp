import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { MetrolinxError } from "../errors.js";
import type { RawStopDetailsResponse } from "../metrolinx/types.js";
import { callTool, fakeClient } from "./test-support.js";

const fixture = JSON.parse(
  readFileSync(
    new URL("../../test/fixtures/stop-details.json", import.meta.url),
    "utf8",
  ),
) as RawStopDetailsResponse;

describe("get_stop_details", () => {
  it("returns the normalized DTO as structuredContent (live-captured Union fixture)", async () => {
    const result = await callTool(
      fakeClient({ getStopDetails: () => Promise.resolve(fixture) }),
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
      fakeClient({ getStopDetails: () => Promise.resolve(fixture) }),
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

  it("returns an in-result not_found error for an unknown stop code", async () => {
    const empty: RawStopDetailsResponse = {
      Metadata: { TimeStamp: "", ErrorCode: "200", ErrorMessage: "OK" },
      Stop: null,
    };
    const result = await callTool(
      fakeClient({ getStopDetails: () => Promise.resolve(empty) }),
      "get_stop_details",
      { stop_code: "NOPE" },
    );

    expect(result.isError).toBe(true);
    expect(result.errorPayload?.error.code).toBe("not_found");
    expect(result.errorPayload?.error.message).toContain("search_stops");
  });

  it("surfaces client failures through the error taxonomy", async () => {
    const result = await callTool(
      fakeClient({
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
