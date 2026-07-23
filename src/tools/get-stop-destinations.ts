import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

import { MetrolinxError, toToolErrorResult } from "../errors.js";
import type { MetrolinxClient } from "../metrolinx/client.js";
import { resolveWireCode } from "../normalize/search-stops.js";
import { normalizeStopDestinations } from "../normalize/stop-destinations.js";
import {
  getStopDestinationsInputShape,
  stopDestinationsOutputShape,
} from "../schemas/stop-destinations.js";
import { addHoursToTime, hhmmToWire, nowInToronto } from "../time.js";

export function registerGetStopDestinations(
  server: McpServer,
  client: MetrolinxClient,
): void {
  server.registerTool(
    "get_stop_destinations",
    {
      title: "Get stop destinations",
      description:
        "Where a GO Transit stop's services go within a time window (default: now to +4h, Toronto).",
      inputSchema: getStopDestinationsInputShape,
      outputSchema: stopDestinationsOutputShape,
    },
    async ({ stop_code, from_time, to_time }): Promise<CallToolResult> => {
      try {
        // Pure bus stops' unified stop_code is their PublicStopId, but
        // Stop/Destinations' code space is unverified live for bus stops
        // (issue #61) — translate defensively via the cached Stop/All
        // dataset, same as get_stop_details' confirmed fix.
        const resolution = resolveWireCode(
          await client.getStopAll(),
          stop_code,
        );
        if (!resolution) {
          throw new MetrolinxError(
            "not_found",
            `Unknown stop code "${stop_code}". Verify via search_stops.`,
            false,
          );
        }
        const fromTime = from_time ?? nowInToronto().time;
        const toTime = to_time ?? addHoursToTime(fromTime, 4);
        const dto = normalizeStopDestinations(
          await client.getStopDestinations(
            resolution.wireCode,
            hhmmToWire(fromTime),
            hhmmToWire(toTime),
          ),
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
