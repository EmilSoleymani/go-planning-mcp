import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { MetrolinxClient } from "./metrolinx/client.js";
import { registerGetStopDetails } from "./tools/get-stop-details.js";

/**
 * Transport-agnostic server assembly: every entry surface (stdio, standalone
 * HTTP, Vercel) calls this and only this (project-architecture spec §3).
 */
export function buildServer(client: MetrolinxClient): McpServer {
  const server = new McpServer({ name: "go-transit-mcp", version: "0.0.0" });
  registerGetStopDetails(server, client);
  return server;
}
