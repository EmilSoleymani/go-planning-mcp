import { describe, expect, it } from "vitest";

import type { TransferHub } from "./transfer-hubs.js";
import { planHubLegs, rankHubs, TRANSFER_HUBS } from "./transfer-hubs.js";

// Synthetic geometry: from/to ~81 km apart on the 43°N parallel, hubs
// placed on or off the straight line so detour ordering is unambiguous.
const FROM = { code: "F1", lat: 43.0, lon: -79.0 };
const TO = { code: "T1", lat: 43.0, lon: -78.0 };

function hub(overrides: Partial<TransferHub> & { code: string }): TransferHub {
  return {
    name: `Hub ${overrides.code}`,
    lat: 43.0,
    lon: -78.5,
    bufferMinutes: 10,
    priority: 1,
    ...overrides,
  };
}

describe("rankHubs", () => {
  it("orders hubs by geometric detour and drops hubs beyond the cutoff ratio", () => {
    const onLine = hub({ code: "AA", lat: 43.0 });
    const slightDetour = hub({ code: "BB", lat: 43.1 });
    // ~0.8° of latitude off the line: detour ratio ≈ 2.4 > 1.6.
    const absurdDetour = hub({ code: "CC", lat: 43.8 });

    const ranked = rankHubs(FROM, TO, [absurdDetour, slightDetour, onLine]);

    expect(ranked.map((h) => h.code)).toEqual(["AA", "BB"]);
  });

  it("excludes hubs that are themselves an endpoint (by code or busCode)", () => {
    const fromHub = hub({ code: "F1" });
    const pairedWithTo = hub({ code: "ZZ", busCode: "T1" });
    const survivor = hub({ code: "AA" });

    const ranked = rankHubs(FROM, TO, [fromHub, pairedWithTo, survivor]);

    expect(ranked.map((h) => h.code)).toEqual(["AA"]);
  });

  it("breaks near-ties (same 5 km detour bucket) by priority", () => {
    const boosted = hub({ code: "UN2", lat: 43.05, priority: 0 });
    const closerButOrdinary = hub({ code: "AA", lat: 43.0, priority: 1 });

    const ranked = rankHubs(FROM, TO, [closerButOrdinary, boosted]);

    expect(ranked.map((h) => h.code)).toEqual(["UN2", "AA"]);
  });

  it("real table: ranks Union first for the ADR-0002 pair Unionville -> Exhibition", () => {
    // York Mills is geometrically a hair closer to the UI->EX line than
    // Union, but lands in the same 5 km detour bucket, where Union's
    // priority boost wins — preserving ADR 0002's via-Union behavior.
    const ranked = rankHubs(
      { code: "UI", lat: 43.8524, lon: -79.312 },
      { code: "EX", lat: 43.6365, lon: -79.4197 },
      TRANSFER_HUBS,
    );

    expect(ranked[0]?.code).toBe("UN");
  });
});

// Which hub code each leg targets, and which buffer applies. Endpoint mode
// flags come from Stop/Details (IsTrain/IsBus): a rail-capable endpoint's
// leg meets the hub on the rail side of a walking pair, a bus-only
// endpoint's leg on the bus side. Crossing the pair costs the pair buffer.
describe("planHubLegs", () => {
  const union = TRANSFER_HUBS.find((h) => h.code === "UN")!;
  const squareOne = TRANSFER_HUBS.find((h) => h.code === "00132")!;
  const rail = { isTrain: true, isBus: false };
  const busOnly = { isTrain: false, isBus: true };

  it("uses the single code and default buffer at a hub without a pair", () => {
    expect(planHubLegs(squareOne, busOnly, busOnly)).toEqual({
      inboundToCode: "00132",
      onwardFromCode: "00132",
      bufferMinutes: 10,
    });
  });

  it("crosses the Union walking pair rail->bus with the 15-minute pair buffer", () => {
    expect(planHubLegs(union, rail, busOnly)).toEqual({
      inboundToCode: "UN",
      onwardFromCode: "02300",
      bufferMinutes: 15,
    });
  });

  it("stays on the rail side with the default buffer for rail->rail at Union", () => {
    expect(planHubLegs(union, rail, rail)).toEqual({
      inboundToCode: "UN",
      onwardFromCode: "UN",
      bufferMinutes: 10,
    });
  });

  it("stays on the bus side for bus->bus at a walking pair", () => {
    expect(planHubLegs(union, busOnly, busOnly)).toEqual({
      inboundToCode: "02300",
      onwardFromCode: "02300",
      bufferMinutes: 10,
    });
  });
});
