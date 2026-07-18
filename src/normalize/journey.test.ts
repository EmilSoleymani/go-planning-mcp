import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import type { RawJourneyResponse } from "../metrolinx/types.js";
import { fakeClient } from "../tools/test-support.js";
import { normalizeJourney, planItineraries } from "./journey.js";

const journeyFixture = JSON.parse(
  readFileSync(
    new URL("../../test/fixtures/schedule-journey.json", import.meta.url),
    "utf8",
  ),
) as RawJourneyResponse;

const stopNames = new Map<string, string>([
  ["UN", "Union Station GO"],
  ["OA", "Oakville GO"],
]);

describe("normalizeJourney", () => {
  it("normalizes the live-captured Union->Oakville fixture into itineraries", () => {
    const result = normalizeJourney(journeyFixture, stopNames);

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({
      departure_time: "2026-07-17T09:10:00-04:00",
      arrival_time: "2026-07-17T09:42:00-04:00",
      duration_minutes: 32,
      transfers: 0,
      accessible: false,
      legs: [
        {
          mode: "train",
          line_code: "LW",
          line_name: "Lakeshore West",
          direction: "W",
          from: {
            stop_code: "UN",
            stop_name: "Union Station GO",
            time: "2026-07-17T09:10:00-04:00",
          },
          to: {
            stop_code: "OA",
            stop_name: "Oakville GO",
            time: "2026-07-17T09:42:00-04:00",
          },
          trip_number: "1961",
        },
      ],
    });
  });

  it("falls back to the raw stop code when a name isn't in the index", () => {
    const result = normalizeJourney(journeyFixture, new Map());
    expect(result[0]?.legs[0]?.from.stop_name).toBe("UN");
    expect(result[0]?.legs[0]?.to.stop_name).toBe("OA");
  });

  it("returns an empty list when SchJourneys is absent", () => {
    const result = normalizeJourney(
      {
        Metadata: { TimeStamp: "", ErrorCode: "200", ErrorMessage: "OK" },
        SchJourneys: null,
      },
      stopNames,
    );
    expect(result).toEqual([]);
  });

  it("returns an empty list when Services is empty (no itineraries right now)", () => {
    const result = normalizeJourney(
      {
        Metadata: { TimeStamp: "", ErrorCode: "200", ErrorMessage: "OK" },
        SchJourneys: [
          {
            Date: "2026-07-17",
            Time: "09:00",
            To: "OA",
            From: "UN",
            Services: [],
          },
        ],
      },
      stopNames,
    );
    expect(result).toEqual([]);
  });

  it("derives transfers from the number of legs, not an upstream field", () => {
    const twoLegService = {
      Metadata: { TimeStamp: "", ErrorCode: "200", ErrorMessage: "OK" },
      SchJourneys: [
        {
          Date: "2026-07-17",
          Time: "09:00",
          To: "OA",
          From: "UN",
          Services: [
            {
              Colour: "#000",
              Type: "RB",
              Direction: "W",
              Code: "01",
              StartTime: "2026-07-17 09:00:00",
              EndTime: "2026-07-17 10:00:00",
              Duration: "01:00:00",
              Accessible: "RB",
              Trips: {
                Trip: [
                  {
                    Number: "1001",
                    Display: "LW - Exhibition GO",
                    Line: "LW",
                    Direction: "W",
                    LineVariant: "LW",
                    Type: "T",
                    Stops: {
                      Stop: [
                        {
                          Code: "UN",
                          Order: 1,
                          Time: "09:00",
                          sortingTime: "0900",
                          IsMajor: true,
                        },
                        {
                          Code: "EX",
                          Order: 2,
                          Time: "09:15",
                          sortingTime: "0915",
                          IsMajor: true,
                        },
                      ],
                    },
                    destinationStopCode: "EX",
                    departFromCode: "UN",
                    departFromAlternativeCode: null,
                    departFromTimingPoint: "union",
                    tripPatternId: 1,
                  },
                  {
                    Number: "1002",
                    Display: "MI - Oakville GO",
                    Line: "MI",
                    Direction: "W",
                    LineVariant: "MI",
                    Type: "B",
                    Stops: {
                      Stop: [
                        {
                          Code: "EX",
                          Order: 1,
                          Time: "09:30",
                          sortingTime: "0930",
                          IsMajor: true,
                        },
                        {
                          Code: "OA",
                          Order: 2,
                          Time: "10:00",
                          sortingTime: "1000",
                          IsMajor: true,
                        },
                      ],
                    },
                    destinationStopCode: "OA",
                    departFromCode: "EX",
                    departFromAlternativeCode: null,
                    departFromTimingPoint: "exhibition",
                    tripPatternId: 2,
                  },
                ],
              },
              Transfers: { Transfer: [] },
              TransferLinks: { Link: [] },
              StartSortTime: "0900",
              EndSortTime: "1000",
              tripHash: "1001_1002",
              transferCount: 1,
            },
          ],
        },
      ],
    };

    const result = normalizeJourney(twoLegService, stopNames);
    expect(result).toHaveLength(1);
    expect(result[0]?.transfers).toBe(1);
    expect(result[0]?.legs).toHaveLength(2);
    expect(result[0]?.legs[1]?.mode).toBe("bus");
    expect(result[0]?.accessible).toBe(true);
  });

  // Defensive: if a multi-leg journey ever appears, departFromCode/
  // destinationStopCode are journey-level (fixture evidence: trip 1961's
  // Stops end at the journey destination, not the train's own terminus) and
  // won't appear in intermediate legs' trimmed Stops — leg boundaries must
  // come from the Stops list itself. No multi-leg journey has been observed
  // live; Schedule/Journey returned SchJourneys: [] for a cross-line pair
  // (tool-schemas spec §5), so this shape is modeled, not captured.
  it("builds legs from each trip's trimmed Stops even when departFromCode/destinationStopCode are journey-level", () => {
    const transferJourney = {
      Metadata: { TimeStamp: "", ErrorCode: "200", ErrorMessage: "OK" },
      SchJourneys: [
        {
          Date: "2026-07-20",
          Time: "08:00",
          To: "EX",
          From: "UI",
          Services: [
            {
              Colour: "#794500",
              Type: "R",
              Direction: "S",
              Code: "71",
              StartTime: "2026-07-20 08:13:00",
              EndTime: "2026-07-20 09:05:00",
              Duration: "00:52:00",
              Accessible: "",
              Trips: {
                Trip: [
                  {
                    Number: "7107",
                    Display: "ST - Union Station GO",
                    Line: "ST",
                    Direction: "S",
                    LineVariant: "ST",
                    Type: "T",
                    Stops: {
                      Stop: [
                        {
                          Code: "UI",
                          Order: 1,
                          Time: "08:13",
                          sortingTime: "0813",
                          IsMajor: true,
                        },
                        {
                          Code: "UN",
                          Order: 2,
                          Time: "08:50",
                          sortingTime: "0850",
                          IsMajor: true,
                        },
                      ],
                    },
                    // Journey-level endpoints, NOT this leg's — "EX" is not
                    // in this trip's Stops.
                    destinationStopCode: "EX",
                    departFromCode: "UI",
                    departFromAlternativeCode: null,
                    departFromTimingPoint: "unionville",
                    tripPatternId: 10,
                  },
                  {
                    Number: "1023",
                    Display: "LW - Exhibition GO",
                    Line: "LW",
                    Direction: "W",
                    LineVariant: "LW",
                    Type: "T",
                    Stops: {
                      Stop: [
                        {
                          Code: "UN",
                          Order: 1,
                          Time: "08:57",
                          sortingTime: "0857",
                          IsMajor: true,
                        },
                        {
                          Code: "EX",
                          Order: 2,
                          Time: "09:05",
                          sortingTime: "0905",
                          IsMajor: true,
                        },
                      ],
                    },
                    // "UI" is not in this trip's Stops either.
                    destinationStopCode: "EX",
                    departFromCode: "UI",
                    departFromAlternativeCode: null,
                    departFromTimingPoint: "unionville",
                    tripPatternId: 11,
                  },
                ],
              },
              Transfers: { Transfer: [] },
              TransferLinks: {
                Link: [
                  {
                    FromTrip: "7107",
                    FromStopCode: "UN",
                    ToTrip: "1023",
                    ToStopCode: "UN",
                    TransferDuration: "00:07:00",
                  },
                ],
              },
              StartSortTime: "0813",
              EndSortTime: "0905",
              tripHash: "7107_1023",
              transferCount: 1,
            },
          ],
        },
      ],
    };

    const result = normalizeJourney(
      transferJourney,
      new Map([["UN", "Union Station GO"]]),
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.transfers).toBe(1);
    expect(result[0]?.legs).toHaveLength(2);

    const [first, second] = result[0]!.legs;
    expect(first).toMatchObject({
      line_code: "ST",
      trip_number: "7107",
      from: { stop_code: "UI" },
      to: {
        stop_code: "UN",
        stop_name: "Union Station GO",
        time: "2026-07-20T08:50:00-04:00",
      },
    });
    expect(second).toMatchObject({
      line_code: "LW",
      trip_number: "1023",
      from: { stop_code: "UN" },
      to: { stop_code: "EX", time: "2026-07-20T09:05:00-04:00" },
    });
  });
});

describe("planItineraries", () => {
  it("depart_after: fetches once for the given time and normalizes the result", async () => {
    let captured: unknown;
    const client = fakeClient({
      getJourney: (dateWire, from, to, startWire, maxJourneys) => {
        captured = [dateWire, from, to, startWire, maxJourneys];
        return Promise.resolve(journeyFixture);
      },
    });

    const result = await planItineraries(
      client,
      "UN",
      "00137",
      "2026-07-17",
      "09:00",
      "depart_after",
      3,
      stopNames,
    );

    expect(captured).toEqual(["20260717", "UN", "00137", "0900", 3]);
    expect(result).toHaveLength(3);
  });

  it("arrive_by: back-shifts ~2h and filters on arrival <= target", async () => {
    const calls: string[] = [];
    const client = fakeClient({
      getJourney: (_dateWire, _from, _to, startWire) => {
        calls.push(startWire);
        return Promise.resolve(journeyFixture);
      },
    });

    // Fixture's last arrival is 10:29 -> target 10:30 keeps all 3.
    const result = await planItineraries(
      client,
      "UN",
      "00137",
      "2026-07-17",
      "10:30",
      "arrive_by",
      3,
      stopNames,
    );

    expect(calls).toEqual(["0830"]);
    expect(result).toHaveLength(3);
  });

  it("arrive_by: widens the window once when the narrow window yields nothing", async () => {
    const calls: string[] = [];
    const client = fakeClient({
      getJourney: (_dateWire, _from, _to, startWire) => {
        calls.push(startWire);
        return Promise.resolve(journeyFixture);
      },
    });

    // Target 09:00 is before every fixture arrival -> narrow window (07:00)
    // filters to empty, triggering the wide-window (05:00) retry, which also
    // filters to empty since the fixture's earliest arrival is still 09:42.
    const result = await planItineraries(
      client,
      "UN",
      "00137",
      "2026-07-17",
      "09:00",
      "arrive_by",
      3,
      stopNames,
    );

    expect(calls).toEqual(["0700", "0500"]);
    expect(result).toEqual([]);
  });
});
