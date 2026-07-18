import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

import { MetrolinxError, toToolErrorResult } from "../errors.js";
import type { MetrolinxClient } from "../metrolinx/client.js";
import { normalizeServiceExceptions } from "../normalize/service-exceptions.js";
import {
  getServiceExceptionsInputShape,
  serviceExceptionsOutputShape,
} from "../schemas/service-exceptions.js";

export function registerGetServiceExceptions(
  server: McpServer,
  client: MetrolinxClient,
): void {
  server.registerTool(
    "get_service_exceptions",
    {
      title: "Get service exceptions",
      description:
        "Today's schedule exceptions — cancelled trips and stops — for GO Transit.",
      inputSchema: getServiceExceptionsInputShape,
      outputSchema: serviceExceptionsOutputShape,
    },
    async ({ mode }): Promise<CallToolResult> => {
      try {
        const dto = normalizeServiceExceptions(
          await client.getServiceExceptions(mode ?? "any"),
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
