import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { MetrolinxError } from "../errors.js";
import type {
  RawJourneyResponse,
  RawStopAllResponse,
} from "../metrolinx/types.js";
import { callTool, fakeClient } from "./test-support.js";

const stopAll = JSON.parse(
  readFileSync(
    new URL("../../test/fixtures/stop-all.json", import.meta.url),
    "utf8",
  ),
) as RawStopAllResponse;

const journeyFixture = JSON.parse(
  readFileSync(
    new URL("../../test/fixtures/schedule-journey.json", import.meta.url),
    "utf8",
  ),
) as RawJourneyResponse;

describe("plan_journey", () => {
  it("returns itineraries for known exact stop codes, no fuzzy resolution", async () => {
    const result = await callTool(
      fakeClient({
        getStopAll: () => Promise.resolve(stopAll),
        getJourney: () => Promise.resolve(journeyFixture),
      }),
      "plan_journey",
      { from_stop_code: "UN", to_stop_code: "102300" },
    );

    expect(result.isError).toBe(false);
    const structured = result.structuredContent as { itineraries: unknown[] };
    expect(structured.itineraries).toHaveLength(3);
  });

  it("returns a not_found error for an unknown from_stop_code", async () => {
    const result = await callTool(
      fakeClient({ getStopAll: () => Promise.resolve(stopAll) }),
      "plan_journey",
      { from_stop_code: "NOPE", to_stop_code: "UN" },
    );

    expect(result.isError).toBe(true);
    expect(result.errorPayload?.error.code).toBe("not_found");
  });

  it("returns a not_found error for an unknown to_stop_code", async () => {
    const result = await callTool(
      fakeClient({ getStopAll: () => Promise.resolve(stopAll) }),
      "plan_journey",
      { from_stop_code: "UN", to_stop_code: "NOPE" },
    );

    expect(result.isError).toBe(true);
    expect(result.errorPayload?.error.code).toBe("not_found");
  });

  it("passes date/time/max_results through as a depart-after query", async () => {
    let captured: unknown;
    await callTool(
      fakeClient({
        getStopAll: () => Promise.resolve(stopAll),
        getJourney: (dateWire, from, to, startWire, maxJourneys) => {
          captured = [dateWire, from, to, startWire, maxJourneys];
          return Promise.resolve(journeyFixture);
        },
      }),
      "plan_journey",
      {
        from_stop_code: "UN",
        to_stop_code: "102300",
        date: "2026-07-17",
        time: "09:00",
        max_results: 7,
      },
    );

    expect(captured).toEqual(["20260717", "UN", "102300", "0900", 7]);
  });

  it("surfaces client failures through the error taxonomy", async () => {
    const result = await callTool(
      fakeClient({
        getStopAll: () =>
          Promise.reject(new MetrolinxError("rate_limited", "wait", false)),
      }),
      "plan_journey",
      { from_stop_code: "UN", to_stop_code: "102300" },
    );

    expect(result.isError).toBe(true);
    expect(result.errorPayload?.error.code).toBe("rate_limited");
  });
});
