import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

import { MetrolinxError, toToolErrorResult } from "../errors.js";
import type { MetrolinxClient } from "../metrolinx/client.js";
import { normalizeServiceGuarantee } from "../normalize/service-guarantee.js";
import {
  getServiceGuaranteeInputShape,
  serviceGuaranteeOutputShape,
} from "../schemas/service-guarantee.js";
import { dateToWire } from "../time.js";

export function registerGetServiceGuarantee(
  server: McpServer,
  client: MetrolinxClient,
): void {
  server.registerTool(
    "get_service_guarantee",
    {
      title: "Get service guarantee",
      description: "Service guarantee eligibility for a past GO Transit trip.",
      inputSchema: getServiceGuaranteeInputShape,
      outputSchema: serviceGuaranteeOutputShape,
    },
    async ({ trip_number, date, lang }): Promise<CallToolResult> => {
      try {
        const dto = normalizeServiceGuarantee(
          await client.getServiceGuarantee(trip_number, dateToWire(date)),
          lang ?? "en",
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
