import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { MetrolinxError } from "../errors.js";
import type { RawServiceGuaranteeResponse } from "../metrolinx/types.js";
import { normalizeServiceGuarantee } from "./service-guarantee.js";

const fixture = JSON.parse(
  readFileSync(
    new URL("../../test/fixtures/service-guarantee.json", import.meta.url),
    "utf8",
  ),
) as RawServiceGuaranteeResponse;

describe("normalizeServiceGuarantee", () => {
  it("marks eligible: true when Stops carries entries", () => {
    const result = normalizeServiceGuarantee(fixture);
    expect(result.eligible).toBe(true);
    expect(result.stops).toEqual([
      {
        stop_code: "OA",
        scope: "One-way fare",
        reason: "Delay exceeded 15 minutes",
      },
      {
        stop_code: "UN",
        scope: "One-way fare",
        reason: "Delay exceeded 15 minutes",
      },
    ]);
  });

  it("falls back to English when the French reason is empty", () => {
    const result = normalizeServiceGuarantee(fixture, "fr");
    const union = result.stops.find((s) => s.stop_code === "UN");
    const oakville = result.stops.find((s) => s.stop_code === "OA");
    expect(union?.reason).toBe("Delay exceeded 15 minutes");
    expect(oakville?.reason).toBe("Retard supérieur à 15 minutes");
  });

  it("marks eligible: false for a present-but-empty Stops array", () => {
    const result = normalizeServiceGuarantee({
      Metadata: { TimeStamp: "", ErrorCode: "200", ErrorMessage: "OK" },
      Stops: { Stop: [] },
    });
    expect(result).toEqual({ eligible: false, stops: [] });
  });

  it("throws a not_found MetrolinxError when Stops is absent", () => {
    expect(() =>
      normalizeServiceGuarantee({
        Metadata: {
          TimeStamp: "2026-07-17 19:46:04",
          ErrorCode: "204",
          ErrorMessage: "No Content",
        },
        Stops: null,
      }),
    ).toThrow(MetrolinxError);
  });
});
