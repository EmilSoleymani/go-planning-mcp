import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

// Proves the hand-written and captured fixtures load and parse cleanly, and
// are shaped the way the client (Metadata.ErrorCode) and tool-layer error
// taxonomy expect (issue #3 acceptance criteria).

function loadFixture(name: string): unknown {
  return JSON.parse(
    readFileSync(new URL(`./${name}`, import.meta.url), "utf8"),
  );
}

interface Envelope {
  Metadata: { ErrorCode: string; ErrorMessage: string };
}

describe("fixtures", () => {
  it.each(["tunneled-401.json", "tunneled-429.json", "tunneled-503.json"])(
    "errors/%s parses as a body-tunneled error envelope",
    (name) => {
      const fixture = loadFixture(`errors/${name}`) as Envelope;
      expect(fixture.Metadata.ErrorCode).toMatch(/^\d{3}$/);
      expect(fixture.Metadata.ErrorMessage).toBeTruthy();
    },
  );

  it("ambiguous-name-oakville.json carries two distinct stop codes for one display name", () => {
    const fixture = loadFixture("ambiguous-name-oakville.json") as {
      Stations: { Station: { LocationCode: string; LocationName: string }[] };
    };
    const stations = fixture.Stations.Station;
    expect(stations).toHaveLength(2);
    expect(new Set(stations.map((s) => s.LocationName))).toEqual(
      new Set(["Oakville GO"]),
    );
    expect(new Set(stations.map((s) => s.LocationCode))).toEqual(
      new Set(["00137", "OA"]),
    );
  });

  it("stop-details.json (live-captured) has the confirmed real field names", () => {
    const fixture = loadFixture("stop-details.json") as {
      Stop: { Code: string; StopName: string };
    };
    expect(fixture.Stop.Code).toBe("UN");
    expect(fixture.Stop.StopName).toBe("Union Station GO");
  });

  // Live-captured by scripts/capture-fixtures.ts (issue #45) — a prior
  // hand-written guess for this endpoint had the wrong time format (bare
  // "HH:MM", not a full naive datetime, per issue #8 follow-up); this
  // fixture is a real payload confirming that shape, not asserting a
  // specific trip's content, since a re-run captures whichever trip number
  // is running at capture time.
  it("schedule-trip.json (live-captured) has bare HH:MM stop times, not full datetimes", () => {
    const fixture = loadFixture("schedule-trip.json") as {
      Trips: { Number: string; Stops: { Code: string }[] }[];
    };
    expect(fixture.Trips[0]?.Number).toMatch(/^\d+$/);
    expect(fixture.Trips[0]?.Stops.length).toBeGreaterThan(0);
  });

  // fleet-consist.json / fleet-consist-engine.json are INTENTIONALLY
  // hand-authored, not real captures (issue #45) — Fleet/Consist/* has
  // returned Metadata.ErrorCode "403" for every key this project has ever
  // had (re-confirmed live by capture-fixtures.ts as of this test), so no
  // real response has ever been available to capture. Field shapes are
  // hand-derived from Metrolinx's Help-page docs (research handoff §2.7),
  // not confirmed against a live payload — see the RawFleetConsistResponse
  // comment in src/metrolinx/types.ts. Re-run scripts/capture-fixtures.ts
  // and replace both files for real if Fleet access is ever granted; this
  // test exists so that swap isn't silently missed.
  it.each(["fleet-consist.json", "fleet-consist-engine.json"])(
    "%s is documented as intentionally hand-authored, pending Fleet access",
    (name) => {
      const fixture = loadFixture(name) as {
        Metadata: { ErrorCode: string };
        AllConsists?: { Consists?: { EngineNumber: string }[] };
      };
      expect(fixture.Metadata.ErrorCode).toBe("200");
      expect(fixture.AllConsists?.Consists?.[0]?.EngineNumber).toBeTruthy();
    },
  );
});
