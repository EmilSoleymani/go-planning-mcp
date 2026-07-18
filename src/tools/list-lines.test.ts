import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { MetrolinxError } from "../errors.js";
import type { RawLineAllResponse } from "../metrolinx/types.js";
import { callTool, fakeClient } from "./test-support.js";

const fixture = JSON.parse(
  readFileSync(
    new URL("../../test/fixtures/schedule-line-all.json", import.meta.url),
    "utf8",
  ),
) as RawLineAllResponse;

describe("list_lines", () => {
  it("returns normalized lines as structuredContent", async () => {
    let capturedDate: string | undefined;
    const result = await callTool(
      fakeClient({
        getLineAll: (dateWire) => {
          capturedDate = dateWire;
          return Promise.resolve(fixture);
        },
      }),
      "list_lines",
      { date: "2026-07-17" },
    );

    expect(result.isError).toBe(false);
    expect(capturedDate).toBe("20260717");
    const structured = result.structuredContent as { lines: unknown[] };
    expect(structured.lines.length).toBe(fixture.AllLines?.Line?.length);
  });

  it("defaults date to today in Toronto wire format", async () => {
    let capturedDate: string | undefined;
    await callTool(
      fakeClient({
        getLineAll: (dateWire) => {
          capturedDate = dateWire;
          return Promise.resolve(fixture);
        },
      }),
      "list_lines",
      {},
    );
    expect(capturedDate).toMatch(/^\d{8}$/);
  });

  it("surfaces client failures through the error taxonomy", async () => {
    const result = await callTool(
      fakeClient({
        getLineAll: () =>
          Promise.reject(
            new MetrolinxError("upstream_unavailable", "wait", true),
          ),
      }),
      "list_lines",
      {},
    );

    expect(result.isError).toBe(true);
    expect(result.errorPayload?.error.code).toBe("upstream_unavailable");
  });
});
