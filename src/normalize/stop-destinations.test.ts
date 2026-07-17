import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { MetrolinxError } from "../errors.js";
import type { RawStopDestinationsResponse } from "../metrolinx/types.js";
import { normalizeStopDestinations } from "./stop-destinations.js";

const fixture = JSON.parse(
  readFileSync(
    new URL("../../test/fixtures/stop-destinations.json", import.meta.url),
    "utf8",
  ),
) as RawStopDestinationsResponse;

describe("normalizeStopDestinations", () => {
  it("dedupes repeated per-departure entries down to unique destinations", () => {
    const result = normalizeStopDestinations(fixture);

    expect(result.destinations.length).toBeLessThan(
      fixture.Stop?.Line?.length ?? 0,
    );
    expect(result.total_matched).toBe(result.destinations.length);
    expect(result.truncated).toBe(false);
  });

  it("recovers destination_stop_name by stripping the line-code Display prefix", () => {
    const result = normalizeStopDestinations(fixture);
    expect(result.destinations).toContainEqual({
      line_code: "BR",
      line_name: "Barrie",
      direction: "N",
      destination_stop_code: "AD",
      destination_stop_name: "Allandale Waterfront GO",
    });
  });

  it("falls back to the raw line code for an unmapped line", () => {
    const result = normalizeStopDestinations({
      Metadata: { TimeStamp: "", ErrorCode: "200", ErrorMessage: "OK" },
      Stop: {
        Code: "UN",
        Name: "Union Station GO",
        Line: [
          {
            Code: "ZZ",
            Display: "ZZ - Nowhere GO",
            Direction: "N",
            DestinationStop: "NW",
          },
        ],
      },
    });
    expect(result.destinations[0]).toMatchObject({
      line_code: "ZZ",
      line_name: "ZZ",
    });
  });

  it("throws a not_found MetrolinxError when Stop is absent", () => {
    expect(() =>
      normalizeStopDestinations({
        Metadata: { TimeStamp: "", ErrorCode: "200", ErrorMessage: "OK" },
        Stop: null,
      }),
    ).toThrow(MetrolinxError);
  });
});
