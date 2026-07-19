// Weekly live-API smoke suite (test-architecture spec §2, cicd-pipeline spec
// §3): one representative call per upstream domain against the real
// Metrolinx API. Pass criterion is `outputSchema.parse` on the live result,
// not HTTP 200 — this answers "has Metrolinx drifted out from under our
// normalization?", not "is the network up?". Empty-but-schema-valid is a
// pass for real-time tools; no assertion here may depend on time of day.
//
// Excluded from the default `test` script by vitest.config.ts
// (`exclude: ["test/smoke/**"]`) and run only via `npm run test:smoke`.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

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

// Local-dev convenience only: fills in unset env vars from a .env file if
// one exists, no dotenv dependency (same minimal parser as
// scripts/capture-fixtures.ts's loadEnvKey). CI sets METROLINX_API_KEY
// directly via the job env and has no .env file, so this is a no-op there;
// an already-set var (shell export, CI) always wins over the file.
function loadDotEnvIfPresent(): void {
  let raw: string;
  try {
    raw = readFileSync(
      fileURLToPath(new URL("../../.env", import.meta.url)),
      "utf8",
    );
  } catch {
    return;
  }
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (key && !(key in process.env)) process.env[key] = value;
  }
}

loadDotEnvIfPresent();

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
      // Hardcoded, not resolved via search_stops: "Oakville GO" is a
      // confirmed live name collision (tool-schemas spec §5) between a Bus
      // Stop and the Train & Bus Station, both landing in the same
      // top-match tier — matches[0] is not reliably the station. "OA" is
      // the station's own stable code, same as "UN"/"LW" elsewhere here.
      const result = await callTool(client, "get_fares", {
        from_stop_code: "UN",
        to_stop_code: "OA",
      });
      expectOk(result);
      const dto = faresOutputSchema.parse(result.structuredContent);
      // Soft invariant is "fares > 0" as in "at least one row exists"
      // (test-architecture spec §2) — not "every amount is positive".
      // Live-confirmed real $0 rows: children ride free, and PRESTO
      // fare-cap tiers (e.g. "PrestoTrips41+") hit $0 after enough trips.
      expect(dto.fares.length).toBeGreaterThan(0);
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
      // feed's first engine so args resolution doesn't depend on time of
      // day. That raw call can itself hit the same Forbidden restriction
      // handled below, so it's wrapped rather than left to throw.
      const args = tripNumber
        ? { trip_number: tripNumber }
        : await client
            .getFleetConsistAll()
            .then((raw) => raw.AllConsists?.Consists?.[0]?.EngineNumber)
            .catch(() => undefined)
            .then((engineNumber) =>
              engineNumber ? { engine_number: engineNumber } : undefined,
            );

      if (!args) {
        console.warn(
          "No fleet consist data available right now — skipping get_fleet_consist assertion.",
        );
        return;
      }

      const result = await callTool(client, "get_fleet_consist", args);

      // The whole Fleet section sits behind separate authorization from the
      // base Open Data API key, undocumented on the Help site — confirmed
      // live back in issue #3/#10 (tunneled Metadata.ErrorCode "403") and
      // again for the sibling Fleet/Occupancy endpoints (issue #11/PR #26;
      // see tool-schemas spec §5 and handoff-001 §2.7). This project's key
      // has never had access to Fleet/Consist/*; a Forbidden response here
      // is the known, expected state, not drift — asserting it as a hard
      // failure would spam the smoke-failure issue every week for a
      // condition that can't change without a key upgrade from Metrolinx.
      if (
        result.isError &&
        result.errorPayload?.error.message.includes("Forbidden")
      ) {
        console.warn(
          "Fleet/Consist is Forbidden for this API key (known limitation, tool-schemas spec §5) — skipping assertion.",
        );
        return;
      }

      expectOk(result);
      expect(() =>
        fleetConsistOutputSchema.parse(result.structuredContent),
      ).not.toThrow();
    },
    LIVE_TIMEOUT_MS,
  );
});
