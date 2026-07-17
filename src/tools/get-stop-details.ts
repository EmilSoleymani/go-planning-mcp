import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

import { MetrolinxError, toToolErrorResult } from "../errors.js";
import type { MetrolinxClient } from "../metrolinx/client.js";
import { normalizeStopDetails } from "../normalize/stop-details.js";
import {
  getStopDetailsInputShape,
  stopDetailsOutputShape,
} from "../schemas/stop-details.js";

export function registerGetStopDetails(
  server: McpServer,
  client: MetrolinxClient,
): void {
  server.registerTool(
    "get_stop_details",
    {
      title: "Get stop details",
      description:
        "Details for one GO Transit stop or station: location, train/bus service, facilities, parking, accessibility.",
      inputSchema: getStopDetailsInputShape,
      outputSchema: stopDetailsOutputShape,
    },
    async ({ stop_code }): Promise<CallToolResult> => {
      try {
        const dto = normalizeStopDetails(
          await client.getStopDetails(stop_code),
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
