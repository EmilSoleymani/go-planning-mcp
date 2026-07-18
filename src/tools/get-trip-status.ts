import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

import { MetrolinxError, toToolErrorResult } from "../errors.js";
import type { MetrolinxClient } from "../metrolinx/client.js";
import { normalizeTripStatus } from "../normalize/trip-status.js";
import {
  getTripStatusInputShape,
  tripStatusOutputShape,
} from "../schemas/trip-status.js";
import { dateToWire, nowInToronto } from "../time.js";

export function registerGetTripStatus(
  server: McpServer,
  client: MetrolinxClient,
): void {
  server.registerTool(
    "get_trip_status",
    {
      title: "Get trip status",
      description:
        "Live stop-by-stop status for a single GO Transit trip, including vehicle position when tracked.",
      inputSchema: getTripStatusInputShape,
      outputSchema: tripStatusOutputShape,
    },
    async ({ trip_number, date }): Promise<CallToolResult> => {
      try {
        const effectiveDate = date ?? nowInToronto().date;
        const [tripStatus, stopAll] = await Promise.all([
          client.getTripStatus(dateToWire(effectiveDate), trip_number),
          client.getStopAll(),
        ]);
        const dto = normalizeTripStatus(tripStatus, stopAll, effectiveDate);
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
