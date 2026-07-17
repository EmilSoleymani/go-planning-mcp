import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { MetrolinxError } from "../errors.js";
import type { RawStopAllResponse } from "../metrolinx/types.js";
import { callTool, fakeClient } from "./test-support.js";

const stopAll = JSON.parse(
  readFileSync(
    new URL("../../test/fixtures/stop-all.json", import.meta.url),
    "utf8",
  ),
) as RawStopAllResponse;

const ambiguous = JSON.parse(
  readFileSync(
    new URL(
      "../../test/fixtures/ambiguous-name-oakville.json",
      import.meta.url,
    ),
    "utf8",
  ),
) as RawStopAllResponse;

describe("search_stops", () => {
  it("returns normalized matches as structuredContent", async () => {
    const result = await callTool(
      fakeClient({ getStopAll: () => Promise.resolve(stopAll) }),
      "search_stops",
      { query: "Union Station GO" },
    );

    expect(result.isError).toBe(false);
    expect(result.structuredContent).toMatchObject({
      matches: [
        { stop_code: "UN", stop_name: "Union Station GO", stop_type: "train" },
      ],
      truncated: false,
    });
  });

  it("reproduces both candidates for the ambiguous-name-oakville fixture", async () => {
    const result = await callTool(
      fakeClient({ getStopAll: () => Promise.resolve(ambiguous) }),
      "search_stops",
      { query: "Oakville GO" },
    );

    const structured = result.structuredContent as {
      matches: { stop_code: string }[];
    };
    expect(structured.matches.map((m) => m.stop_code).sort()).toEqual([
      "100137",
      "OA",
    ]);
  });

  it("honors the limit input and reports truncation", async () => {
    const result = await callTool(
      fakeClient({ getStopAll: () => Promise.resolve(stopAll) }),
      "search_stops",
      { query: "GO", limit: 2 },
    );

    const structured = result.structuredContent as {
      matches: unknown[];
      truncated: boolean;
    };
    expect(structured.matches).toHaveLength(2);
    expect(structured.truncated).toBe(true);
  });

  it("surfaces client failures through the error taxonomy", async () => {
    const result = await callTool(
      fakeClient({
        getStopAll: () =>
          Promise.reject(
            new MetrolinxError("upstream_unavailable", "try later", true),
          ),
      }),
      "search_stops",
      { query: "union" },
    );

    expect(result.isError).toBe(true);
    expect(result.errorPayload?.error.code).toBe("upstream_unavailable");
  });
});
