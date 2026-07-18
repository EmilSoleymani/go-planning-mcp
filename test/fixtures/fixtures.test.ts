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

  // Live-captured manually (issue #8 follow-up, PR #22 review) — the
  // original hand-written guess for this endpoint had the wrong time
  // format (bare "HH:MM", not a full naive datetime); this fixture is the
  // real payload that caught it. scripts/capture-fixtures.ts still doesn't
  // cover this endpoint (see issue #25).
  it("schedule-trip.json (live-captured) has bare HH:MM stop times, not full datetimes", () => {
    const fixture = loadFixture("schedule-trip.json") as {
      Trips: { Number: string; Stops: { Code: string }[] }[];
    };
    expect(fixture.Trips[0]?.Number).toBe("1039");
    expect(fixture.Trips[0]?.Stops.length).toBeGreaterThan(0);
  });
});
