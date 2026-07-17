import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { MetrolinxClient } from "./metrolinx/client.js";
import { registerGetNextService } from "./tools/get-next-service.js";
import { registerGetStopDestinations } from "./tools/get-stop-destinations.js";
import { registerGetStopDetails } from "./tools/get-stop-details.js";
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
