import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

import { MetrolinxError, toToolErrorResult } from "../errors.js";
import type { MetrolinxClient } from "../metrolinx/client.js";
import { normalizeFares } from "../normalize/fares.js";
import { faresOutputShape, getFaresInputShape } from "../schemas/fares.js";
import { dateToWire } from "../time.js";

export function registerGetFares(
  server: McpServer,
  client: MetrolinxClient,
): void {
  server.registerTool(
    "get_fares",
    {
      title: "Get fares",
      description:
        "Fare rows (rider type, payment method, amount) between two GO Transit stops, flattened from Metrolinx's category/ticket nesting.",
      inputSchema: getFaresInputShape,
      outputSchema: faresOutputShape,
    },
    async ({ from_stop_code, to_stop_code, date }): Promise<CallToolResult> => {
      try {
        const dto = normalizeFares(
          await client.getFares(
            from_stop_code,
            to_stop_code,
            date ? dateToWire(date) : undefined,
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
