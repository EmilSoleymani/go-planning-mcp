import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

import { MetrolinxError, toToolErrorResult } from "../errors.js";
import type { MetrolinxClient } from "../metrolinx/client.js";
import { normalizeUnionDepartures } from "../normalize/union-departures.js";
import {
  getUnionDeparturesInputShape,
  unionDeparturesOutputShape,
} from "../schemas/union-departures.js";

export function registerGetUnionDepartures(
  server: McpServer,
  client: MetrolinxClient,
): void {
  server.registerTool(
    "get_union_departures",
    {
      title: "Get Union departures",
      description: "Live Union Station departure board for trains and buses.",
      inputSchema: getUnionDeparturesInputShape,
      outputSchema: unionDeparturesOutputShape,
    },
    async ({ mode }): Promise<CallToolResult> => {
      try {
        const [departures, stopAll] = await Promise.all([
          client.getUnionDepartures(),
          client.getStopAll(),
        ]);
        const dto = normalizeUnionDepartures(
          departures,
          stopAll,
          mode ?? "any",
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
