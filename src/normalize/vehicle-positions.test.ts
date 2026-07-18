import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import type {
  RawGtfsVehiclePositionsResponse,
  RawServiceGlanceResponse,
  RawStopAllResponse,
} from "../metrolinx/types.js";
import { normalizeVehiclePositions } from "./vehicle-positions.js";

const glance = JSON.parse(
  readFileSync(
    new URL("../../test/fixtures/service-glance-trains.json", import.meta.url),
    "utf8",
  ),
) as RawServiceGlanceResponse;

const positions = JSON.parse(
  readFileSync(
    new URL("../../test/fixtures/gtfs-vehicle-positions.json", import.meta.url),
    "utf8",
  ),
) as RawGtfsVehiclePositionsResponse;

const stopAll = JSON.parse(
  readFileSync(
    new URL("../../test/fixtures/stop-all.json", import.meta.url),
    "utf8",
  ),
) as RawStopAllResponse;

describe("normalizeVehiclePositions", () => {
  it("normalizes the live-captured Trains ServiceataGlance fixture", () => {
    const result = normalizeVehiclePositions(
      glance,
      positions,
      stopAll,
      "train",
      {},
      20,
    );

    const trip1026 = result.vehicles.find((v) => v.trip_number === "1026");
    expect(trip1026).toMatchObject({
      line_code: "LW",
      mode: "train",
      position: { lat: 43.551859, lon: -79.591621 },
      delay_minutes: 3,
      in_motion: true,
      updated_at: "2026-07-17T16:46:45-04:00",
    });
  });

  it("merges occupancy_percent from the GTFS-RT VehiclePositions feed by trip number", () => {
    const result = normalizeVehiclePositions(
      glance,
      positions,
      stopAll,
      "train",
      {},
      20,
    );
    expect(
      result.vehicles.find((v) => v.trip_number === "1026")?.occupancy_percent,
    ).toBe(62);
  });

  it("omits occupancy_percent when the GTFS-RT feed has no matching entry", () => {
    const result = normalizeVehiclePositions(
      glance,
      positions,
      stopAll,
      "train",
      {},
      20,
    );
    expect(
      result.vehicles.find((v) => v.trip_number === "1028")?.occupancy_percent,
    ).toBeUndefined();
  });

  it("never surfaces a GTFS-RT vehicle that isn't in the ServiceataGlance snapshot", () => {
    const result = normalizeVehiclePositions(
      glance,
      positions,
      stopAll,
      "train",
      {},
      20,
    );
    expect(result.vehicles.some((v) => v.trip_number === "90001")).toBe(false);
  });

  it("resolves next_stop's stop_name via the cached Stop/All dataset", () => {
    const result = normalizeVehiclePositions(
      glance,
      positions,
      stopAll,
      "train",
      {},
      20,
    );
    expect(
      result.vehicles.find((v) => v.trip_number === "1026")?.next_stop,
    ).toEqual({ stop_code: "PO", stop_name: "Port Credit GO" });
  });

  it("falls back to the raw code as stop_name when it isn't in Stop/All", () => {
    const result = normalizeVehiclePositions(
      glance,
      positions,
      stopAll,
      "train",
      {},
      20,
    );
    expect(
      result.vehicles.find((v) => v.trip_number === "1028")?.next_stop,
    ).toEqual({ stop_code: "WATE", stop_name: "WATE" });
  });

  it("filters by line_code", () => {
    const result = normalizeVehiclePositions(
      glance,
      positions,
      stopAll,
      "train",
      { line_code: "MI" },
      20,
    );
    expect(result.vehicles.length).toBeGreaterThan(0);
    expect(result.vehicles.every((v) => v.line_code === "MI")).toBe(true);
  });

  it("filters by trip_number", () => {
    const result = normalizeVehiclePositions(
      glance,
      positions,
      stopAll,
      "train",
      { trip_number: "1026" },
      20,
    );
    expect(result.vehicles).toHaveLength(1);
    expect(result.vehicles[0]?.trip_number).toBe("1026");
  });

  it("caps results at limit and reports truncation", () => {
    const result = normalizeVehiclePositions(
      glance,
      positions,
      stopAll,
      "train",
      {},
      3,
    );
    expect(result.vehicles).toHaveLength(3);
    expect(result.truncated).toBe(true);
    expect(result.total_matched).toBeGreaterThan(3);
  });

  it("returns an empty vehicles list when Trips is absent", () => {
    const result = normalizeVehiclePositions(
      {
        Metadata: { TimeStamp: "", ErrorCode: "200", ErrorMessage: "OK" },
        Trips: null,
      },
      positions,
      stopAll,
      "train",
      {},
      20,
    );
    expect(result).toEqual({
      vehicles: [],
      truncated: false,
      total_matched: 0,
    });
  });
});
