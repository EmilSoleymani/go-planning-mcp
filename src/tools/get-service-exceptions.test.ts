import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { MetrolinxError } from "../errors.js";
import type { RawServiceExceptionsResponse } from "../metrolinx/types.js";
import { callTool, fakeClient } from "./test-support.js";

const fixture = JSON.parse(
  readFileSync(
    new URL("../../test/fixtures/service-exceptions.json", import.meta.url),
    "utf8",
  ),
) as RawServiceExceptionsResponse;

describe("get_service_exceptions", () => {
  it("returns normalized exceptions as structuredContent", async () => {
    let capturedMode: string | undefined;
    const result = await callTool(
      fakeClient({
        getServiceExceptions: (mode) => {
          capturedMode = mode;
          return Promise.resolve(fixture);
        },
      }),
      "get_service_exceptions",
      {},
    );

    expect(result.isError).toBe(false);
    expect(capturedMode).toBe("any");
    const structured = result.structuredContent as {
      exceptions: { trip_number: string; cancelled: boolean }[];
    };
    expect(
      structured.exceptions.find((e) => e.trip_number === "E1960")?.cancelled,
    ).toBe(true);
  });

  it("passes the mode filter straight through to the client", async () => {
    let capturedMode: string | undefined;
    await callTool(
      fakeClient({
        getServiceExceptions: (mode) => {
          capturedMode = mode;
          return Promise.resolve(fixture);
        },
      }),
      "get_service_exceptions",
      { mode: "train" },
    );

    expect(capturedMode).toBe("train");
  });

  it("surfaces client failures through the error taxonomy", async () => {
    const result = await callTool(
      fakeClient({
        getServiceExceptions: () =>
          Promise.reject(new MetrolinxError("rate_limited", "wait", false)),
      }),
      "get_service_exceptions",
      {},
    );

    expect(result.isError).toBe(true);
    expect(result.errorPayload?.error.code).toBe("rate_limited");
  });
});
