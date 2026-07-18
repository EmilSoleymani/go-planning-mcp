// Weekly live-API smoke suite (test-architecture spec §2, cicd-pipeline spec
// §3): one representative call per upstream domain against the real
// Metrolinx API. Pass criterion is `outputSchema.parse` on the live result,
// not HTTP 200 — this answers "has Metrolinx drifted out from under our
// normalization?", not "is the network up?". Empty-but-schema-valid is a
// pass for real-time tools; no assertion here may depend on time of day.
//
// Excluded from the default `test` script by vitest.config.ts
// (`exclude: ["test/smoke/**"]`) and run only via `npm run test:smoke`.
import { describe, expect, it } from "vitest";

import { MetrolinxHttpClient } from "../../src/metrolinx/client.js";
import { faresOutputSchema } from "../../src/schemas/fares.js";
import { lineScheduleOutputSchema } from "../../src/schemas/line-schedule.js";
import { listLinesOutputSchema } from "../../src/schemas/list-lines.js";
import { nextServiceOutputSchema } from "../../src/schemas/next-service.js";
import { planTripOutputSchema } from "../../src/schemas/journey.js";
import { searchStopsOutputSchema } from "../../src/schemas/search-stops.js";
import { serviceAlertsOutputSchema } from "../../src/schemas/service-alerts.js";
import { stopDetailsSchema } from "../../src/schemas/stop-details.js";
import { tripUpdatesOutputSchema } from "../../src/schemas/trip-updates.js";
import { unionDeparturesOutputSchema } from "../../src/schemas/union-departures.js";
import { vehiclePositionsOutputSchema } from "../../src/schemas/vehicle-positions.js";
import { fleetConsistOutputSchema } from "../../src/schemas/fleet-consist.js";
import {
  callTool,
  type CallToolOutcome,
} from "../../src/tools/test-support.js";

const apiKey = process.env.METROLINX_API_KEY;
if (!apiKey) {
  throw new Error(
    'METROLINX_API_KEY is required to run the smoke suite (see CONTRIBUTING.md, "Getting a Metrolinx API key").',
  );
}

const client = new MetrolinxHttpClient({ apiKey });
const LIVE_TIMEOUT_MS = 30_000;

function expectOk(outcome: CallToolOutcome): void {
  expect(outcome.isError, JSON.stringify(outcome.errorPayload)).toBe(false);
}

describe("live API smoke suite", () => {
  it(
    'search_stops — Stop/All ("union")',
    async () => {
      const result = await callTool(client, "search_stops", {
        query: "union",
      });
      expectOk(result);
      const dto = searchStopsOutputSchema.parse(result.structuredContent);
      expect(dto.matches.length).toBeGreaterThan(0);

      // Soft invariant on the full dataset search_stops matches against
      // (test-architecture spec §2). Reuses the client's 24h stop cache
      // populated by the call above — no extra live request.
      const stopAll = await client.getStopAll();
      expect(stopAll.Stations?.Station?.length ?? 0).toBeGreaterThan(100);
    },
    LIVE_TIMEOUT_MS,
  );

  it(
    "get_stop_details — Stop/Details (UN)",
    async () => {
      const result = await callTool(client, "get_stop_details", {
        stop_code: "UN",
      });
      expectOk(result);
      expect(() =>
        stopDetailsSchema.parse(result.structuredContent),
      ).not.toThrow();
    },
    LIVE_TIMEOUT_MS,
  );

  it(
    "get_next_service — Stop/NextService (UN)",
    async () => {
      const result = await callTool(client, "get_next_service", {
        stop_code: "UN",
      });
      expectOk(result);
      expect(() =>
        nextServiceOutputSchema.parse(result.structuredContent),
      ).not.toThrow();
    },
    LIVE_TIMEOUT_MS,
  );

  it(
    "plan_trip — Schedule/Journey (Union → Oakville, today)",
    async () => {
      const result = await callTool(client, "plan_trip", {
        from: "Union",
        to: "Oakville",
      });
      expectOk(result);
      expect(() =>
        planTripOutputSchema.parse(result.structuredContent),
      ).not.toThrow();
    },
    LIVE_TIMEOUT_MS,
  );

  it(
    "list_lines — Schedule/Line/All",
    async () => {
      const result = await callTool(client, "list_lines", {});
      expectOk(result);
      const dto = listLinesOutputSchema.parse(result.structuredContent);
      expect(dto.lines.some((line) => line.line_code === "LW")).toBe(true);
    },
    LIVE_TIMEOUT_MS,
  );

  it(
    "get_line_schedule — Schedule/Line (LW)",
    async () => {
      const lines = await callTool(client, "list_lines", {});
      expectOk(lines);
      const linesDto = listLinesOutputSchema.parse(lines.structuredContent);
      const lw = linesDto.lines.find((line) => line.line_code === "LW");
      expect(lw).toBeDefined();
      const direction = lw?.variants[0]?.direction;
      expect(direction).toBeDefined();

      const result = await callTool(client, "get_line_schedule", {
        line_code: "LW",
        direction,
      });
      expectOk(result);
      expect(() =>
        lineScheduleOutputSchema.parse(result.structuredContent),
      ).not.toThrow();
    },
    LIVE_TIMEOUT_MS,
  );

  it(
    "get_service_alerts — ServiceUpdate/ServiceAlert",
    async () => {
      const result = await callTool(client, "get_service_alerts", {});
      expectOk(result);
      expect(() =>
        serviceAlertsOutputSchema.parse(result.structuredContent),
      ).not.toThrow();
    },
    LIVE_TIMEOUT_MS,
  );

  it(
    "get_union_departures — ServiceUpdate/UnionDepartures",
    async () => {
      const result = await callTool(client, "get_union_departures", {});
      expectOk(result);
      expect(() =>
        unionDeparturesOutputSchema.parse(result.structuredContent),
      ).not.toThrow();
    },
    LIVE_TIMEOUT_MS,
  );

  it(
    "get_fares — Fares (UN → Oakville)",
    async () => {
      const oakville = await callTool(client, "search_stops", {
        query: "oakville",
        limit: 1,
      });
      expectOk(oakville);
      const matches = searchStopsOutputSchema.parse(
        oakville.structuredContent,
      ).matches;
      expect(matches.length).toBeGreaterThan(0);

      const result = await callTool(client, "get_fares", {
        from_stop_code: "UN",
        to_stop_code: matches[0]!.stop_code,
      });
      expectOk(result);
      const dto = faresOutputSchema.parse(result.structuredContent);
      expect(dto.fares.length).toBeGreaterThan(0);
      for (const fare of dto.fares) expect(fare.amount).toBeGreaterThan(0);
    },
    LIVE_TIMEOUT_MS,
  );

  it(
    "get_vehicle_positions — ServiceataGlance + GTFS-RT VehiclePosition (train)",
    async () => {
      const result = await callTool(client, "get_vehicle_positions", {
        mode: "train",
      });
      expectOk(result);
      expect(() =>
        vehiclePositionsOutputSchema.parse(result.structuredContent),
      ).not.toThrow();
    },
    LIVE_TIMEOUT_MS,
  );

  it(
    "get_trip_updates — Gtfs/Feed/TripUpdates (unfiltered)",
    async () => {
      const result = await callTool(client, "get_trip_updates", {});
      expectOk(result);
      expect(() =>
        tripUpdatesOutputSchema.parse(result.structuredContent),
      ).not.toThrow();
    },
    LIVE_TIMEOUT_MS,
  );

  it(
    "get_fleet_consist — Fleet/Consist (trip from positions call)",
    async () => {
      const positions = await callTool(client, "get_vehicle_positions", {
        mode: "train",
      });
      expectOk(positions);
      const vehiclesDto = vehiclePositionsOutputSchema.parse(
        positions.structuredContent,
      );
      const tripNumber = vehiclesDto.vehicles[0]?.trip_number;

      // No train currently running is a legitimate real-time-empty state
      // (test-architecture spec §2) — fall back to the raw Fleet/Consist/All
      // feed's first engine so Fleet domain coverage doesn't depend on time
      // of day. Only skip if that feed itself is empty.
      const args = tripNumber
        ? { trip_number: tripNumber }
        : await (async () => {
            const raw = await client.getFleetConsistAll();
            const engineNumber = raw.AllConsists?.Consists?.[0]?.EngineNumber;
            return engineNumber ? { engine_number: engineNumber } : undefined;
          })();

      if (!args) {
        console.warn(
          "No fleet consist data available right now — skipping get_fleet_consist assertion.",
        );
        return;
      }

      const result = await callTool(client, "get_fleet_consist", args);
      expectOk(result);
      expect(() =>
        fleetConsistOutputSchema.parse(result.structuredContent),
      ).not.toThrow();
    },
    LIVE_TIMEOUT_MS,
  );
});
