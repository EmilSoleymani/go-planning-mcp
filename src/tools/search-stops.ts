import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

import { MetrolinxError, toToolErrorResult } from "../errors.js";
import type { MetrolinxClient } from "../metrolinx/client.js";
import { normalizeSearchStops } from "../normalize/search-stops.js";
import {
  searchStopsInputShape,
  searchStopsOutputShape,
} from "../schemas/search-stops.js";

export function registerSearchStops(
  server: McpServer,
  client: MetrolinxClient,
): void {
  server.registerTool(
    "search_stops",
    {
      title: "Search stops",
      description:
        "Fuzzy search for GO Transit stops and stations by name fragment (e.g. 'union', 'oakville').",
      inputSchema: searchStopsInputShape,
      outputSchema: searchStopsOutputShape,
    },
    async ({ query, stop_type, limit }): Promise<CallToolResult> => {
      try {
        const dto = normalizeSearchStops(
          await client.getStopAll(),
          query,
          stop_type ?? "any",
          limit ?? 10,
        );
        return {
          content: [{ type: "text", text: JSON.stringify(dto) }],
          structuredContent: dto,
        };
      } catch (error) {
        if (error instanceof MetrolinxError) return toToolErrorResult(error);
        throw error;
      }
    },
  );
}
