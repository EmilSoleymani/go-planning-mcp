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

    // "102300" (USBT's unified PublicStopId) goes upstream as its wire
    // LocationCode "02300" — Schedule/Journey returns empty for unified
    // bus-stop codes (confirmed live 2026-07-21, issue #35).
    expect(captured).toEqual(["20260717", "UN", "02300", "0900", 5]);
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

  const empty = {
    Metadata: { TimeStamp: "", ErrorCode: "200", ErrorMessage: "OK" },
    SchJourneys: [],
  };
  const segment = (
    dep: string,
    arr: string,
    trip: string,
    fromCode: string,
    toCode: string,
  ): RawJourneyResponse => ({
    Metadata: { TimeStamp: "", ErrorCode: "200", ErrorMessage: "OK" },
    SchJourneys: [
      {
        Date: "2026-07-20",
        Time: "08:00",
        To: toCode,
        From: fromCode,
        Services: [
          {
            Colour: "#000",
            Type: "R",
            Direction: "S",
            Code: "01",
            StartTime: `2026-07-20 ${dep}:00`,
            EndTime: `2026-07-20 ${arr}:00`,
            Duration: "",
            Accessible: "",
            Trips: {
              Trip: [
                {
                  Number: trip,
                  Display: "test",
                  Line: "ST",
                  Direction: "S",
                  LineVariant: "ST",
                  Type: "T",
                  Stops: {
                    Stop: [
                      {
                        Code: fromCode,
                        Order: 1,
                        Time: dep,
                        sortingTime: null,
                        IsMajor: true,
                      },
                      {
                        Code: toCode,
                        Order: 2,
                        Time: arr,
                        sortingTime: null,
                        IsMajor: true,
                      },
                    ],
                  },
                  destinationStopCode: toCode,
                  departFromCode: fromCode,
                  departFromAlternativeCode: null,
                  departFromTimingPoint: "",
                  tripPatternId: 0,
                },
              ],
            },
            Transfers: { Transfer: [] },
            TransferLinks: { Link: [] },
          },
        ],
      },
    ],
  });

  it("composes a via-Union transfer when the direct journey query is empty (ADR 0002)", async () => {
    // The hub ladder reads endpoint coordinates + mode flags (ADR 0003).
    const coords: Record<string, { lat: number; lon: number }> = {
      UI: { lat: 43.8524, lon: -79.312 },
      EX: { lat: 43.6365, lon: -79.4197 },
    };
    const result = await callTool(
      fakeClient({
        getStopAll: () => Promise.resolve(stopAll),
        getStopDetails: (code) =>
          Promise.resolve({
            Metadata: { TimeStamp: "", ErrorCode: "200", ErrorMessage: "OK" },
            Stop: {
              Code: code,
              StopName: `Stop ${code}`,
              StopNameFr: "",
              City: "",
              Latitude: String(coords[code]?.lat),
              Longitude: String(coords[code]?.lon),
              IsBus: false,
              IsTrain: true,
              Facilities: null,
              Parkings: null,
              BoardingInfo: "",
              BoardingInfoFr: "",
              DrivingDirections: "",
              DrivingDirectionsFr: "",
            },
          }),
        getJourney: (_dateWire, from, to) => {
          if (from === "UI" && to === "UN") {
            return Promise.resolve(
              segment("08:13", "08:50", "7107", "UI", "UN"),
            );
          }
          if (from === "UN" && to === "EX") {
            return Promise.resolve(
              segment("09:05", "09:13", "1023", "UN", "EX"),
            );
          }
          return Promise.resolve(empty);
        },
      }),
      "plan_trip",
      { from: "UI", to: "EX", date: "2026-07-20", time: "08:00" },
    );

    expect(result.isError).toBe(false);
    const structured = result.structuredContent as {
      status: string;
      itineraries: {
        transfers: number;
        composed?: boolean;
        legs: { trip_number: string; from: { stop_code: string } }[];
      }[];
    };
    expect(structured.status).toBe("ok");
    expect(structured.itineraries).toHaveLength(1);
    expect(structured.itineraries[0]?.transfers).toBe(1);
    // Server-composed pairing is marked; not a GO-published connection.
    expect(structured.itineraries[0]?.composed).toBe(true);
    expect(structured.itineraries[0]?.legs.map((l) => l.trip_number)).toEqual([
      "7107",
      "1023",
    ]);
    expect(structured.itineraries[0]?.legs[1]?.from.stop_code).toBe("UN");
  });

  // Confirmed live (2026-07-21): Schedule/Journey returns empty for the
  // unified PublicStopId codes bus-only stops resolve to — the wire
  // LocationCode must be used upstream while the DTO echoes unified codes.
  it("queries journeys with wire LocationCodes for bus-only endpoints while echoing unified codes", async () => {
    const captured: string[][] = [];
    const result = await callTool(
      fakeClient({
        getStopAll: () => Promise.resolve(stopAll),
        getJourney: (_dateWire, from, to) => {
          captured.push([from, to]);
          return Promise.resolve(
            segment("08:30", "09:15", "4101", "00132", "02816"),
          );
        },
      }),
      "plan_trip",
      { from: "100132", to: "102816", date: "2026-07-22", time: "08:00" },
    );

    expect(result.isError).toBe(false);
    expect(captured).toEqual([["00132", "02816"]]);
    const structured = result.structuredContent as {
      status: string;
      from?: { stop_code: string };
      to?: { stop_code: string };
      itineraries?: unknown[];
    };
    expect(structured.status).toBe("ok");
    expect(structured.from?.stop_code).toBe("100132");
    expect(structured.to?.stop_code).toBe("102816");
    expect(structured.itineraries).toHaveLength(1);
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
