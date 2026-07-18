import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import type { RawFaresResponse } from "../metrolinx/types.js";
import { callTool, fakeClient } from "./test-support.js";

const fixture = JSON.parse(
  readFileSync(
    new URL("../../test/fixtures/fares.json", import.meta.url),
    "utf8",
  ),
) as RawFaresResponse;

describe("get_fares", () => {
  it("returns flattened fare rows as structuredContent", async () => {
    let capturedArgs: [string, string, string | undefined] | undefined;
    const result = await callTool(
      fakeClient({
        getFares: (from, to, date) => {
          capturedArgs = [from, to, date];
          return Promise.resolve(fixture);
        },
      }),
      "get_fares",
      { from_stop_code: "UN", to_stop_code: "OA" },
    );

    expect(result.isError).toBe(false);
    expect(capturedArgs).toEqual(["UN", "OA", undefined]);
    expect(result.structuredContent).toMatchObject({
      fares: expect.arrayContaining([
        { rider: "adult", method: "paper", amount: 9.7, category: "Normal" },
      ]) as unknown,
    });
  });

  it("converts an optional date to yyyymmdd wire format", async () => {
    let capturedArgs: [string, string, string | undefined] | undefined;
    await callTool(
      fakeClient({
        getFares: (from, to, date) => {
          capturedArgs = [from, to, date];
          return Promise.resolve(fixture);
        },
      }),
      "get_fares",
      { from_stop_code: "UN", to_stop_code: "OA", date: "2026-07-20" },
    );

    expect(capturedArgs).toEqual(["UN", "OA", "20260720"]);
  });

  it("returns a not_found error when no fare exists between the stops", async () => {
    const result = await callTool(
      fakeClient({
        getFares: () =>
          Promise.resolve({
            Metadata: { TimeStamp: "", ErrorCode: "200", ErrorMessage: "OK" },
            AllFares: null,
          }),
      }),
      "get_fares",
      { from_stop_code: "UN", to_stop_code: "NOPE" },
    );

    expect(result.isError).toBe(true);
    expect(result.errorPayload?.error.code).toBe("not_found");
  });
});
