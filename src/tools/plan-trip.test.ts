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

const ambiguous = JSON.parse(
  readFileSync(
    new URL(
      "../../test/fixtures/ambiguous-name-oakville.json",
      import.meta.url,
    ),
    "utf8",
  ),
) as RawStopAllResponse;

const journeyFixture = JSON.parse(
  readFileSync(
    new URL("../../test/fixtures/schedule-journey.json", import.meta.url),
    "utf8",
  ),
) as RawJourneyResponse;

describe("plan_trip", () => {
  it("resolves 'from' by fuzzy name and 'to' by exact stop code, returning itineraries", async () => {
    const result = await callTool(
      fakeClient({
        getStopAll: () => Promise.resolve(stopAll),
        getJourney: () => Promise.resolve(journeyFixture),
      }),
      "plan_trip",
      { from: "Union Station GO", to: "102300" },
    );

    expect(result.isError).toBe(false);
    expect(result.structuredContent).toMatchObject({
      status: "ok",
      from: { stop_code: "UN", stop_name: "Union Station GO" },
      to: { stop_code: "102300", stop_name: "Union Station Bus Terminal" },
    });
    const structured = result.structuredContent as { itineraries: unknown[] };
    expect(structured.itineraries).toHaveLength(3);
  });

  it("returns status ambiguous with search_stops-reproducible candidates for both fields", async () => {
    const result = await callTool(
      fakeClient({ getStopAll: () => Promise.resolve(ambiguous) }),
      "plan_trip",
      { from: "Oakville GO", to: "Oakville GO" },
    );

    expect(result.isError).toBe(false);
    const structured = result.structuredContent as {
      status: string;
      ambiguities: { field: string; candidates: { stop_code: string }[] }[];
    };
    expect(structured.status).toBe("ambiguous");
    expect(structured.ambiguities).toHaveLength(2);
    expect(structured.ambiguities.map((a) => a.field)).toEqual(["from", "to"]);
    for (const ambiguity of structured.ambiguities) {
      expect(new Set(ambiguity.candidates.map((c) => c.stop_code))).toEqual(
        new Set(["100137", "OA"]),
      );
    }
  });

  it("returns a not_found error when 'from' matches no stop", async () => {
    const result = await callTool(
      fakeClient({ getStopAll: () => Promise.resolve(stopAll) }),
      "plan_trip",
      { from: "zzzznotarealstopzzzz", to: "Union Station GO" },
    );

    expect(result.isError).toBe(true);
    expect(result.errorPayload?.error.code).toBe("not_found");
  });

  it("passes date/time/max_results through to the journey call, defaulting time_mode to depart_after", async () => {
    let captured: unknown;
    await callTool(
      fakeClient({
        getStopAll: () => Promise.resolve(stopAll),
        getJourney: (dateWire, from, to, startWire, maxJourneys) => {
          captured = [dateWire, from, to, startWire, maxJourneys];
          return Promise.resolve(journeyFixture);
        },
      }),
      "plan_trip",
      {
        from: "UN",
        to: "102300",
        date: "2026-07-17",
        time: "09:00",
        max_results: 5,
      },
    );

    expect(captured).toEqual(["20260717", "UN", "102300", "0900", 5]);
  });

  it("emulates arrive_by by back-shifting the query window ~2h", async () => {
    const calls: string[] = [];
    const result = await callTool(
      fakeClient({
        getStopAll: () => Promise.resolve(stopAll),
        getJourney: (_dateWire, _from, _to, startWire) => {
          calls.push(startWire);
          return Promise.resolve(journeyFixture);
        },
      }),
      "plan_trip",
      {
        from: "UN",
        to: "102300",
        date: "2026-07-17",
        time: "10:30",
        time_mode: "arrive_by",
      },
    );

    expect(calls).toEqual(["0830"]);
    const structured = result.structuredContent as { itineraries: unknown[] };
    expect(structured.itineraries).toHaveLength(3);
  });

  it("surfaces client failures through the error taxonomy", async () => {
    const result = await callTool(
      fakeClient({
        getStopAll: () =>
          Promise.reject(
            new MetrolinxError("upstream_unavailable", "try later", true),
          ),
      }),
      "plan_trip",
      { from: "UN", to: "102300" },
    );

    expect(result.isError).toBe(true);
    expect(result.errorPayload?.error.code).toBe("upstream_unavailable");
  });
});
