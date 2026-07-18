import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { MetrolinxClient } from "./metrolinx/client.js";
import { registerPrompts } from "./prompts.js";
import { registerResources } from "./resources.js";
import { registerGetFares } from "./tools/get-fares.js";
import { registerGetFleetConsist } from "./tools/get-fleet-consist.js";
import { registerGetLineSchedule } from "./tools/get-line-schedule.js";
import { registerGetNextService } from "./tools/get-next-service.js";
import { registerGetServiceAlerts } from "./tools/get-service-alerts.js";
import { registerGetServiceExceptions } from "./tools/get-service-exceptions.js";
import { registerGetServiceGuarantee } from "./tools/get-service-guarantee.js";
import { registerGetStopDestinations } from "./tools/get-stop-destinations.js";
import { registerGetStopDetails } from "./tools/get-stop-details.js";
import { registerGetTripStatus } from "./tools/get-trip-status.js";
import { registerGetTripUpdates } from "./tools/get-trip-updates.js";
import { registerGetUnionDepartures } from "./tools/get-union-departures.js";
import { registerGetVehiclePositions } from "./tools/get-vehicle-positions.js";
import { registerListLines } from "./tools/list-lines.js";
import { registerPlanJourney } from "./tools/plan-journey.js";
import { registerPlanTrip } from "./tools/plan-trip.js";
import { registerSearchStops } from "./tools/search-stops.js";

export const SERVER_INFO = { name: "go-transit-mcp", version: "0.0.0" };

/**
 * Registers every tool/resource/prompt onto a server instance. Shared by
 * `buildServer()` and the Vercel adapter (`api/mcp.ts`), which must register
 * onto an `McpServer` that `mcp-handler` constructs itself rather than
 * calling `buildServer()` directly (project-architecture spec §3).
 */
export function registerTools(
  server: McpServer,
  client: MetrolinxClient,
): void {
  registerGetStopDetails(server, client);
  registerSearchStops(server, client);
  registerGetNextService(server, client);
  registerGetStopDestinations(server, client);
  registerGetFares(server, client);
  registerGetFleetConsist(server, client);
  registerGetServiceAlerts(server, client);
  registerGetServiceExceptions(server, client);
  registerGetServiceGuarantee(server, client);
  registerGetUnionDepartures(server, client);
  registerListLines(server, client);
  registerGetLineSchedule(server, client);
  registerGetTripStatus(server, client);
  registerResources(server, client);
  registerPrompts(server);
  registerGetVehiclePositions(server, client);
  registerGetTripUpdates(server, client);
  registerPlanTrip(server, client);
  registerPlanJourney(server, client);
}

/**
 * Transport-agnostic server assembly: the stdio and standalone HTTP entry
 * surfaces call this and only this (project-architecture spec §3).
 */
export function buildServer(client: MetrolinxClient): McpServer {
  const server = new McpServer(SERVER_INFO);
  registerTools(server, client);
  return server;
}
