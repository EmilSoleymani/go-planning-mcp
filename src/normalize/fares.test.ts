import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { MetrolinxError } from "../errors.js";
import type { RawFaresResponse } from "../metrolinx/types.js";
import { normalizeFares } from "./fares.js";

const fixture = JSON.parse(
  readFileSync(
    new URL("../../test/fixtures/fares.json", import.meta.url),
    "utf8",
  ),
) as RawFaresResponse;

describe("normalizeFares", () => {
  it("flattens the live-captured category -> ticket -> fare nesting into rows", () => {
    const result = normalizeFares(fixture);

    expect(result.truncated).toBe(false);
    expect(result.total_matched).toBe(result.fares.length);
    expect(result.fares).toContainEqual({
      rider: "adult",
      method: "paper",
      amount: 9.7,
      category: "Normal",
    });
    expect(result.fares).toContainEqual({
      rider: "adult",
      method: "presto",
      amount: 8.16,
      category: "Normal",
    });
    expect(result.fares).toContainEqual({
      rider: "senior",
      method: "presto",
      amount: 4.35,
      category: "Normal",
    });
  });

  it("drops Group Pass rows — no per-rider concept fits the closed rider enum", () => {
    const result = normalizeFares(fixture);
    expect(result.fares.some((f) => f.category === "Group Pass")).toBe(false);
    // Confirm the fixture actually contains a Group Pass category, so this
    // test would fail if the drop logic silently stopped filtering anything.
    expect(
      fixture.AllFares?.FareCategory?.some((c) => c.Type === "Group Pass"),
    ).toBe(true);
  });

  it("throws a not_found MetrolinxError when AllFares is absent", () => {
    expect(() =>
      normalizeFares({
        Metadata: { TimeStamp: "", ErrorCode: "200", ErrorMessage: "OK" },
        AllFares: null,
      }),
    ).toThrow(MetrolinxError);
  });

  it("defaults an unrecognized ticket type to the paper method", () => {
    const result = normalizeFares({
      Metadata: { TimeStamp: "", ErrorCode: "200", ErrorMessage: "OK" },
      AllFares: {
        FareCategory: [
          {
            Type: "Adult",
            Tickets: [
              {
                Type: "Cash",
                Fares: [{ Type: "X", Amount: 1, Category: "Normal" }],
              },
            ],
          },
        ],
      },
    });
    expect(result.fares[0]?.method).toBe("paper");
  });
});
