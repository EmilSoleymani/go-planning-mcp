import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import type {
  RawJourneyResponse,
  RawStopDetailsResponse,
} from "../metrolinx/types.js";
import { fakeClient } from "../tools/test-support.js";
import type { JourneyQuery } from "./journey.js";
import { normalizeJourney, planItineraries } from "./journey.js";
import { rankHubs } from "./transfer-hubs.js";

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

function query(overrides: Partial<JourneyQuery>): JourneyQuery {
  return {
    from: "UN",
    to: "00137",
    date: "2026-07-17",
    time: "09:00",
    timeMode: "depart_after",
    maxResults: 3,
    composeTransfers: false,
    ...overrides,
  };
}

// Minimal raw Schedule/Journey response: one single-trip service per entry,
// stops trimmed to the ridden portion (the confirmed live shape).
function rawJourney(
  date: string,
  services: {
    dep: string;
    arr: string;
    line: string;
    trip: string;
    fromCode: string;
    toCode: string;
  }[],
): RawJourneyResponse {
  return {
    Metadata: { TimeStamp: "", ErrorCode: "200", ErrorMessage: "OK" },
    SchJourneys: [
      {
        Date: date,
        Time: "08:00",
        To: "",
        From: "",
        Services: services.map((s) => ({
          Colour: "#000",
          Type: "R",
          Direction: "S",
          Code: s.line,
          StartTime: `${date} ${s.dep}:00`,
          EndTime: `${date} ${s.arr}:00`,
          Duration: "",
          Accessible: "",
          Trips: {
            Trip: [
              {
                Number: s.trip,
                Display: `${s.line} - test`,
                Line: s.line,
                Direction: "S",
                LineVariant: s.line,
                Type: "T",
                Stops: {
                  Stop: [
                    {
                      Code: s.fromCode,
                      Order: 1,
                      Time: s.dep,
                      sortingTime: null,
                      IsMajor: true,
                    },
                    {
                      Code: s.toCode,
                      Order: 2,
                      Time: s.arr,
                      sortingTime: null,
                      IsMajor: true,
                    },
                  ],
                },
                destinationStopCode: s.toCode,
                departFromCode: s.fromCode,
                departFromAlternativeCode: null,
                departFromTimingPoint: "",
                tripPatternId: 0,
              },
            ],
          },
          Transfers: { Transfer: [] },
          TransferLinks: { Link: [] },
        })),
      },
    ],
  };
}

const emptyJourney: RawJourneyResponse = {
  Metadata: { TimeStamp: "", ErrorCode: "200", ErrorMessage: "OK" },
  SchJourneys: [],
};

describe("planItineraries", () => {
  it("depart_after: fetches once for the given time and normalizes the result", async () => {
    let captured: unknown;
    const client = fakeClient({
      getJourney: (dateWire, from, to, startWire, maxJourneys) => {
        captured = [dateWire, from, to, startWire, maxJourneys];
        return Promise.resolve(journeyFixture);
      },
    });

    const result = await planItineraries(client, query({}), stopNames);

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
      query({ time: "10:30", timeMode: "arrive_by" }),
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
      query({ timeMode: "arrive_by" }),
      stopNames,
    );

    expect(calls).toEqual(["0700", "0500"]);
    expect(result).toEqual([]);
  });
});

// Minimal Stop/Details response: coordinates + mode flags are all the hub
// ladder reads (ADR 0003).
function stopDetails(
  code: string,
  lat: number,
  lon: number,
  modes: { isTrain: boolean; isBus: boolean },
): RawStopDetailsResponse {
  return {
    Metadata: { TimeStamp: "", ErrorCode: "200", ErrorMessage: "OK" },
    Stop: {
      Code: code,
      StopName: `Stop ${code}`,
      StopNameFr: "",
      City: "",
      Latitude: String(lat),
      Longitude: String(lon),
      IsBus: modes.isBus,
      IsTrain: modes.isTrain,
      Facilities: null,
      Parkings: null,
      BoardingInfo: "",
      BoardingInfoFr: "",
      DrivingDirections: "",
      DrivingDirectionsFr: "",
    },
  };
}

function detailsFor(
  map: Record<string, RawStopDetailsResponse>,
): (code: string) => Promise<RawStopDetailsResponse> {
  return (code) => {
    const details = map[code];
    return details
      ? Promise.resolve(details)
      : Promise.reject(new Error(`no details stub for ${code}`));
  };
}

// ADR 0002/0003: when the direct query is empty and composeTransfers is on,
// compose one transfer at a hub from two journey calls, walking the
// detour-ranked hub ladder. Union outranks every hub near its detour bucket,
// so the ADR 0002 UI->EX behavior is preserved through the unified ladder.
describe("planItineraries hub-ladder composition", () => {
  // Routes the fake by (from, to) pair: UI->EX direct is empty (the
  // confirmed live behavior for cross-line pairs), the two segments exist.
  function stitchingClient(calls: string[][]) {
    return fakeClient({
      getStopDetails: detailsFor({
        UI: stopDetails("UI", 43.8524, -79.312, { isTrain: true, isBus: true }),
        EX: stopDetails("EX", 43.6365, -79.4197, {
          isTrain: true,
          isBus: false,
        }),
      }),
      getJourney: (dateWire, from, to, startWire, maxJourneys) => {
        calls.push([dateWire, from, to, startWire, String(maxJourneys)]);
        if (from === "UI" && to === "UN") {
          return Promise.resolve(
            rawJourney("2026-07-20", [
              // prettier-ignore
              { dep: "08:13", arr: "08:50", line: "ST", trip: "7107", fromCode: "UI", toCode: "UN" },
              // prettier-ignore
              { dep: "08:43", arr: "09:20", line: "ST", trip: "7109", fromCode: "UI", toCode: "UN" },
            ]),
          );
        }
        if (from === "UN" && to === "EX") {
          return Promise.resolve(
            rawJourney("2026-07-20", [
              // 08:55 violates the 10-min buffer for an 08:50 arrival and
              // must be skipped in favor of 09:05.
              // prettier-ignore
              { dep: "08:55", arr: "09:03", line: "LW", trip: "1021", fromCode: "UN", toCode: "EX" },
              // prettier-ignore
              { dep: "09:05", arr: "09:13", line: "LW", trip: "1023", fromCode: "UN", toCode: "EX" },
              // prettier-ignore
              { dep: "09:35", arr: "09:43", line: "LW", trip: "1025", fromCode: "UN", toCode: "EX" },
            ]),
          );
        }
        return Promise.resolve(emptyJourney);
      },
    });
  }

  it("composes via the top-ranked hub (Union) when the direct query is empty", async () => {
    const calls: string[][] = [];
    const result = await planItineraries(
      stitchingClient(calls),
      query({
        from: "UI",
        to: "EX",
        date: "2026-07-20",
        time: "08:00",
        composeTransfers: true,
      }),
      stopNames,
    );

    // Direct attempt, then the two segments; onward requested from the
    // earliest inbound arrival's clock time.
    expect(calls).toEqual([
      ["20260720", "UI", "EX", "0800", "3"],
      ["20260720", "UI", "UN", "0800", "3"],
      ["20260720", "UN", "EX", "0850", "3"],
    ]);

    expect(result).toHaveLength(2);
    const [first, second] = result;
    // 08:50 arrival + 10-min buffer skips the 08:55 onward for 09:05.
    expect(first).toMatchObject({
      departure_time: "2026-07-20T08:13:00-04:00",
      arrival_time: "2026-07-20T09:13:00-04:00",
      duration_minutes: 60,
      transfers: 1,
      // The pairing is ours, not a GO-published connection (ADR 0003).
      composed: true,
    });
    expect(first?.legs.map((l) => l.trip_number)).toEqual(["7107", "1023"]);
    expect(first?.legs[1]?.from.stop_code).toBe("UN");
    // 09:20 arrival pairs with the 09:35 onward.
    expect(second?.legs.map((l) => l.trip_number)).toEqual(["7109", "1025"]);
    expect(second?.duration_minutes).toBe(60);
  });

  it("does not compose when the direct query already has itineraries", async () => {
    const calls: string[][] = [];
    const client = fakeClient({
      getJourney: (dateWire, from, to, startWire, maxJourneys) => {
        calls.push([dateWire, from, to, startWire, String(maxJourneys)]);
        return Promise.resolve(journeyFixture);
      },
    });

    const result = await planItineraries(
      client,
      query({ composeTransfers: true }),
      stopNames,
    );

    expect(calls).toHaveLength(1);
    expect(result).toHaveLength(3);
    // Direct upstream itineraries carry no composed flag.
    expect(result[0]?.composed).toBeUndefined();
  });

  it("does not compose when an endpoint already is Union", async () => {
    const calls: string[][] = [];
    const client = fakeClient({
      getStopDetails: detailsFor({
        UN: stopDetails("UN", 43.6453, -79.3806, {
          isTrain: true,
          isBus: true,
        }),
        EX: stopDetails("EX", 43.6365, -79.4197, {
          isTrain: true,
          isBus: false,
        }),
      }),
      getJourney: (dateWire, from, to, startWire, maxJourneys) => {
        calls.push([dateWire, from, to, startWire, String(maxJourneys)]);
        return Promise.resolve(emptyJourney);
      },
    });

    const result = await planItineraries(
      client,
      query({ from: "UN", to: "EX", composeTransfers: true }),
      stopNames,
    );

    expect(calls).toHaveLength(1);
    expect(result).toEqual([]);
  });

  it("never composes with viaUnionFallback off (plan_journey's raw mirror)", async () => {
    const calls: string[][] = [];
    const client = fakeClient({
      getJourney: (dateWire, from, to, startWire, maxJourneys) => {
        calls.push([dateWire, from, to, startWire, String(maxJourneys)]);
        return Promise.resolve(emptyJourney);
      },
    });

    const result = await planItineraries(
      client,
      query({ from: "UI", to: "EX" }),
      stopNames,
    );

    expect(calls).toHaveLength(1);
    expect(result).toEqual([]);
  });

  it("returns empty when no onward departure clears the transfer buffer", async () => {
    const client = fakeClient({
      getStopDetails: detailsFor({
        UI: stopDetails("UI", 43.8524, -79.312, { isTrain: true, isBus: true }),
        EX: stopDetails("EX", 43.6365, -79.4197, {
          isTrain: true,
          isBus: false,
        }),
      }),
      getJourney: (_dateWire, from, to) => {
        if (from === "UI" && to === "UN") {
          return Promise.resolve(
            rawJourney("2026-07-20", [
              // prettier-ignore
              { dep: "08:13", arr: "08:50", line: "ST", trip: "7107", fromCode: "UI", toCode: "UN" },
            ]),
          );
        }
        if (from === "UN" && to === "EX") {
          return Promise.resolve(
            rawJourney("2026-07-20", [
              // prettier-ignore
              { dep: "08:55", arr: "09:03", line: "LW", trip: "1021", fromCode: "UN", toCode: "EX" },
            ]),
          );
        }
        return Promise.resolve(emptyJourney);
      },
    });

    const result = await planItineraries(
      client,
      query({
        from: "UI",
        to: "EX",
        date: "2026-07-20",
        time: "08:00",
        composeTransfers: true,
      }),
      stopNames,
    );

    expect(result).toEqual([]);
  });

  it("arrive_by composes via Union inside the back-shifted window", async () => {
    const calls: string[][] = [];
    const result = await planItineraries(
      stitchingClient(calls),
      query({
        from: "UI",
        to: "EX",
        date: "2026-07-20",
        time: "10:00",
        timeMode: "arrive_by",
        composeTransfers: true,
      }),
      stopNames,
    );

    // Back-shifted to 08:00; both composed arrivals (09:13, 09:43) <= 10:00.
    expect(calls[0]).toEqual(["20260720", "UI", "EX", "0800", "3"]);
    expect(result).toHaveLength(2);
    expect(result[0]?.transfers).toBe(1);
  });

  // Bus-only curbside endpoints (Mississauga-ish -> Kitchener-ish): the
  // motivating bus-to-bus case. Ladder order is derived from the tested
  // rankHubs unit rather than hardcoded, so curated-coordinate tweaks don't
  // break these tests.
  const F1 = { code: "F1", lat: 43.6, lon: -79.65 };
  const T1 = { code: "T1", lat: 43.44, lon: -80.48 };
  const busOnlyDetails = detailsFor({
    F1: stopDetails("F1", F1.lat, F1.lon, { isTrain: false, isBus: true }),
    T1: stopDetails("T1", T1.lat, T1.lon, { isTrain: false, isBus: true }),
  });
  const ladder = rankHubs(F1, T1);
  // A bus-only endpoint meets a walking-pair hub on its bus side.
  const hubCode = (i: number): string => ladder[i]!.busCode ?? ladder[i]!.code;

  it("continues down the ladder when the top hub yields no inbound leg", async () => {
    const calls: string[][] = [];
    const client = fakeClient({
      getStopDetails: busOnlyDetails,
      getJourney: (_dateWire, from, to) => {
        calls.push([from, to]);
        if (from === "F1" && to === hubCode(1)) {
          return Promise.resolve(
            rawJourney("2026-07-20", [
              // prettier-ignore
              { dep: "08:20", arr: "09:00", line: "BUS", trip: "9001", fromCode: "F1", toCode: hubCode(1) },
            ]),
          );
        }
        if (from === hubCode(1) && to === "T1") {
          return Promise.resolve(
            rawJourney("2026-07-20", [
              // prettier-ignore
              { dep: "09:10", arr: "10:00", line: "BUS", trip: "9002", fromCode: hubCode(1), toCode: "T1" },
            ]),
          );
        }
        return Promise.resolve(emptyJourney);
      },
    });

    const result = await planItineraries(
      client,
      query({
        from: "F1",
        to: "T1",
        date: "2026-07-20",
        time: "08:00",
        composeTransfers: true,
      }),
      stopNames,
    );

    // Direct, hub 1 inbound (empty -> onward skipped), hub 2 inbound+onward.
    expect(calls).toEqual([
      ["F1", "T1"],
      ["F1", hubCode(0)],
      ["F1", hubCode(1)],
      [hubCode(1), "T1"],
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ transfers: 1, composed: true });
    expect(result[0]?.legs.map((l) => l.trip_number)).toEqual(["9001", "9002"]);
  });

  it("probes at most three hubs (ADR 0003 call budget)", async () => {
    const calls: string[][] = [];
    const client = fakeClient({
      getStopDetails: busOnlyDetails,
      getJourney: (_dateWire, from, to) => {
        calls.push([from, to]);
        return Promise.resolve(emptyJourney);
      },
    });

    const result = await planItineraries(
      client,
      query({ from: "F1", to: "T1", composeTransfers: true }),
      stopNames,
    );

    expect(result).toEqual([]);
    // Direct + three inbound probes; empty inbounds never trigger onwards.
    expect(calls).toEqual([
      ["F1", "T1"],
      ["F1", hubCode(0)],
      ["F1", hubCode(1)],
      ["F1", hubCode(2)],
    ]);
  });

  it("arrive_by: the widened retry probes only the top-ranked hub", async () => {
    const calls: string[][] = [];
    const client = fakeClient({
      getStopDetails: busOnlyDetails,
      getJourney: (_dateWire, from, to, startWire) => {
        calls.push([from, to, startWire]);
        return Promise.resolve(emptyJourney);
      },
    });

    const result = await planItineraries(
      client,
      query({
        from: "F1",
        to: "T1",
        time: "10:00",
        timeMode: "arrive_by",
        composeTransfers: true,
      }),
      stopNames,
    );

    expect(result).toEqual([]);
    // Narrow window (08:00): direct + 3 hub probes; wide window (06:00):
    // direct + 1 hub probe (K=1, ADR 0003).
    expect(calls).toEqual([
      ["F1", "T1", "0800"],
      ["F1", hubCode(0), "0800"],
      ["F1", hubCode(1), "0800"],
      ["F1", hubCode(2), "0800"],
      ["F1", "T1", "0600"],
      ["F1", hubCode(0), "0600"],
    ]);
  });

  it("crosses the Union walking pair for a bus-only origin with the 15-minute pair buffer", async () => {
    // B1 sits at Unionville's coordinates but is bus-only, so its inbound
    // leg targets USBT (02300) while the rail onward departs from UN.
    const calls: string[][] = [];
    const client = fakeClient({
      getStopDetails: detailsFor({
        B1: stopDetails("B1", 43.8524, -79.312, {
          isTrain: false,
          isBus: true,
        }),
        EX: stopDetails("EX", 43.6365, -79.4197, {
          isTrain: true,
          isBus: false,
        }),
      }),
      getJourney: (_dateWire, from, to) => {
        calls.push([from, to]);
        if (from === "B1" && to === "02300") {
          return Promise.resolve(
            rawJourney("2026-07-20", [
              // prettier-ignore
              { dep: "08:13", arr: "08:50", line: "BUS", trip: "9001", fromCode: "B1", toCode: "02300" },
            ]),
          );
        }
        if (from === "UN" && to === "EX") {
          return Promise.resolve(
            rawJourney("2026-07-20", [
              // 13 minutes after the 08:50 arrival: clears the default 10
              // but violates the UN<->USBT pair buffer of 15.
              // prettier-ignore
              { dep: "09:03", arr: "09:11", line: "LW", trip: "9002", fromCode: "UN", toCode: "EX" },
              // prettier-ignore
              { dep: "09:06", arr: "09:14", line: "LW", trip: "9003", fromCode: "UN", toCode: "EX" },
            ]),
          );
        }
        return Promise.resolve(emptyJourney);
      },
    });

    const result = await planItineraries(
      client,
      query({
        from: "B1",
        to: "EX",
        date: "2026-07-20",
        time: "08:00",
        composeTransfers: true,
      }),
      stopNames,
    );

    expect(calls).toContainEqual(["B1", "02300"]);
    expect(calls).toContainEqual(["UN", "EX"]);
    expect(result).toHaveLength(1);
    expect(result[0]?.legs.map((l) => l.trip_number)).toEqual(["9001", "9003"]);
    expect(result[0]?.composed).toBe(true);
  });
});
