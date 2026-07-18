import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { MetrolinxError } from "../errors.js";
import type { RawServiceGuaranteeResponse } from "../metrolinx/types.js";
import { callTool, fakeClient } from "./test-support.js";

const fixture = JSON.parse(
  readFileSync(
    new URL("../../test/fixtures/service-guarantee.json", import.meta.url),
    "utf8",
  ),
) as RawServiceGuaranteeResponse;

describe("get_service_guarantee", () => {
  it("returns normalized eligibility as structuredContent", async () => {
    let capturedArgs: [string, string] | undefined;
    const result = await callTool(
      fakeClient({
        getServiceGuarantee: (tripNumber, dateWire) => {
          capturedArgs = [tripNumber, dateWire];
          return Promise.resolve(fixture);
        },
      }),
      "get_service_guarantee",
      { trip_number: "1029", date: "2026-07-17" },
    );

    expect(result.isError).toBe(false);
    expect(capturedArgs).toEqual(["1029", "20260717"]);
    expect(result.structuredContent).toMatchObject({ eligible: true });
  });

  it("surfaces client failures through the error taxonomy", async () => {
    const result = await callTool(
      fakeClient({
        getServiceGuarantee: () =>
          Promise.reject(new MetrolinxError("rate_limited", "wait", false)),
      }),
      "get_service_guarantee",
      { trip_number: "1029", date: "2026-07-17" },
    );

    expect(result.isError).toBe(true);
    expect(result.errorPayload?.error.code).toBe("rate_limited");
  });

  it("returns eligible: false, not an error, when Stops is absent (live-confirmed)", async () => {
    const result = await callTool(
      fakeClient({
        getServiceGuarantee: () =>
          Promise.resolve({
            Metadata: {
              TimeStamp: "2026-07-17 19:46:04",
              ErrorCode: "200",
              ErrorMessage: "OK",
            },
            Stops: null,
          }),
      }),
      "get_service_guarantee",
      { trip_number: "1029", date: "2026-07-17" },
    );

    expect(result.isError).toBe(false);
    expect(result.structuredContent).toEqual({ eligible: false, stops: [] });
  });
});
