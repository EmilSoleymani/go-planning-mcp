import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

import { MetrolinxError, toToolErrorResult } from "../errors.js";
import type { MetrolinxClient } from "../metrolinx/client.js";
import { normalizeNextService } from "../normalize/next-service.js";
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
        const dto = normalizeNextService(
          await client.getNextService(stop_code),
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
