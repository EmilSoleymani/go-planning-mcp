import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

import { MetrolinxError, toToolErrorResult } from "../errors.js";
import type { MetrolinxClient } from "../metrolinx/client.js";
import { normalizeTripUpdates } from "../normalize/trip-updates.js";
import {
  getTripUpdatesInputShape,
  tripUpdatesOutputShape,
} from "../schemas/trip-updates.js";

export function registerGetTripUpdates(
  server: McpServer,
  client: MetrolinxClient,
): void {
  server.registerTool(
    "get_trip_updates",
    {
      title: "Get trip updates",
      description:
        "What's off-plan right now. Unfiltered: only trips with a material delay or cancelled/skipped stops. With any filter: everything matching, including on-time confirmations.",
      inputSchema: getTripUpdatesInputShape,
      outputSchema: tripUpdatesOutputShape,
    },
    async ({
      line_code,
      trip_number,
      stop_code,
      limit,
    }): Promise<CallToolResult> => {
      try {
        const raw = await client.getTripUpdates();
        const dto = normalizeTripUpdates(
          raw,
          { line_code, trip_number, stop_code },
          limit ?? 20,
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
