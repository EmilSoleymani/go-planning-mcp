import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import type { RawLineAllResponse } from "../metrolinx/types.js";
import { normalizeListLines } from "./list-lines.js";

const fixture = JSON.parse(
  readFileSync(
    new URL("../../test/fixtures/schedule-line-all.json", import.meta.url),
    "utf8",
  ),
) as RawLineAllResponse;

describe("normalizeListLines", () => {
  it("normalizes the live-captured line roster", () => {
    const result = normalizeListLines(fixture);

    expect(result.total_matched).toBe(fixture.AllLines?.Line?.length);
    expect(result.truncated).toBe(false);

    const lw = result.lines.find((line) => line.line_code === "18");
    expect(lw).toMatchObject({
      line_code: "18",
      line_name: "Lakeshore West",
    });
    expect(lw?.variants.length).toBeGreaterThan(0);
    expect(lw?.variants[0]).toMatchObject({
      code: expect.any(String) as string,
      direction: expect.any(String) as string,
      display: expect.any(String) as string,
    });
  });

  it("derives modes from IsBus/IsTrain flags", () => {
    const result = normalizeListLines({
      Metadata: { TimeStamp: "", ErrorCode: "200", ErrorMessage: "OK" },
      AllLines: {
        Line: [
          {
            Name: "Lakeshore West",
            Code: "LW",
            IsBus: false,
            IsTrain: true,
            Variant: [
              { Code: "LW", Display: "LW - Union Station", Direction: "E" },
            ],
          },
          {
            Name: "Milton / Oakville",
            Code: "22",
            IsBus: true,
            IsTrain: false,
            Variant: null,
          },
        ],
      },
    });

    expect(result.lines[0]).toMatchObject({
      line_code: "LW",
      modes: ["train"],
    });
    expect(result.lines[1]).toMatchObject({
      line_code: "22",
      modes: ["bus"],
      variants: [],
    });
  });

  it("returns an empty list when AllLines is absent", () => {
    const result = normalizeListLines({
      Metadata: { TimeStamp: "", ErrorCode: "200", ErrorMessage: "OK" },
    });
    expect(result).toEqual({ lines: [], truncated: false, total_matched: 0 });
  });
});
