import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { MetrolinxError } from "../errors.js";
import type {
  RawGtfsVehiclePositionsResponse,
  RawServiceGlanceResponse,
  RawStopAllResponse,
} from "../metrolinx/types.js";
import { callTool, fakeClient } from "./test-support.js";

const glanceFixture = JSON.parse(
  readFileSync(
    new URL("../../test/fixtures/service-glance-trains.json", import.meta.url),
    "utf8",
  ),
) as RawServiceGlanceResponse;

const positionsFixture = JSON.parse(
  readFileSync(
    new URL("../../test/fixtures/gtfs-vehicle-position.json", import.meta.url),
    "utf8",
  ),
) as RawGtfsVehiclePositionsResponse;

const stopAllFixture = JSON.parse(
  readFileSync(
    new URL("../../test/fixtures/stop-all.json", import.meta.url),
    "utf8",
  ),
) as RawStopAllResponse;

describe("get_vehicle_positions", () => {
  it("returns normalized vehicles as structuredContent", async () => {
    const result = await callTool(
      fakeClient({
        getServiceGlance: () => Promise.resolve(glanceFixture),
        getVehiclePositions: () => Promise.resolve(positionsFixture),
        getStopAll: () => Promise.resolve(stopAllFixture),
      }),
      "get_vehicle_positions",
      { mode: "train" },
    );

    expect(result.isError).toBe(false);
    const structured = result.structuredContent as {
      vehicles: { trip_number: string; occupancy_percent?: number }[];
    };
    expect(structured.vehicles.length).toBeGreaterThan(0);
    expect(
      structured.vehicles.find((v) => v.trip_number === "1026")
        ?.occupancy_percent,
    ).toBe(62);
  });

  it("requests the mode-specific ServiceataGlance feed", async () => {
    let requestedMode: string | undefined;
    await callTool(
      fakeClient({
        getServiceGlance: (mode) => {
          requestedMode = mode;
          return Promise.resolve(glanceFixture);
        },
        getVehiclePositions: () => Promise.resolve(positionsFixture),
        getStopAll: () => Promise.resolve(stopAllFixture),
      }),
      "get_vehicle_positions",
      { mode: "bus" },
    );

    expect(requestedMode).toBe("bus");
  });

  it("applies the line_code filter", async () => {
    const result = await callTool(
      fakeClient({
        getServiceGlance: () => Promise.resolve(glanceFixture),
        getVehiclePositions: () => Promise.resolve(positionsFixture),
        getStopAll: () => Promise.resolve(stopAllFixture),
      }),
      "get_vehicle_positions",
      { mode: "train", line_code: "MI" },
    );

    const structured = result.structuredContent as {
      vehicles: { line_code: string }[];
    };
    expect(structured.vehicles.length).toBeGreaterThan(0);
    expect(structured.vehicles.every((v) => v.line_code === "MI")).toBe(true);
  });

  it("surfaces client failures through the error taxonomy", async () => {
    const result = await callTool(
      fakeClient({
        getServiceGlance: () =>
          Promise.reject(new MetrolinxError("rate_limited", "wait", false)),
      }),
      "get_vehicle_positions",
      { mode: "train" },
    );

    expect(result.isError).toBe(true);
    expect(result.errorPayload?.error.code).toBe("rate_limited");
  });
});
