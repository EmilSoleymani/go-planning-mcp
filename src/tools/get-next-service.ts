import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

import { MetrolinxError, toToolErrorResult } from "../errors.js";
import type { MetrolinxClient } from "../metrolinx/client.js";
import { normalizeNextService } from "../normalize/next-service.js";
import { resolveWireCode } from "../normalize/search-stops.js";
import {
  getNextServiceInputShape,
  nextServiceOutputShape,
} from "../schemas/next-service.js";

export function registerGetNextService(
  server: McpServer,
  client: MetrolinxClient,
): void {
  server.registerTool(
    "get_next_service",
    {
      title: "Get next service",
      description:
        "Live upcoming departures for one GO Transit stop, with delay and status.",
      inputSchema: getNextServiceInputShape,
      outputSchema: nextServiceOutputShape,
    },
    async ({ stop_code }): Promise<CallToolResult> => {
      try {
        // Pure bus stops' unified stop_code is their PublicStopId, but
        // Stop/NextService's code space is unverified live for bus stops
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
        const dto = normalizeNextService(
          await client.getNextService(resolution.wireCode),
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
