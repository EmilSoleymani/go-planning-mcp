import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

import { MetrolinxError, toToolErrorResult } from "../errors.js";
import type { MetrolinxClient } from "../metrolinx/client.js";
import { normalizeListLines } from "../normalize/list-lines.js";
import {
  listLinesInputShape,
  listLinesOutputShape,
} from "../schemas/list-lines.js";
import { dateToWire, nowInToronto } from "../time.js";

export function registerListLines(
  server: McpServer,
  client: MetrolinxClient,
): void {
  server.registerTool(
    "list_lines",
    {
      title: "List lines",
      description:
        "GO Transit's line roster for a service day, including valid direction codes for get_line_schedule.",
      inputSchema: listLinesInputShape,
      outputSchema: listLinesOutputShape,
    },
    async ({ date }): Promise<CallToolResult> => {
      try {
        const dateWire = dateToWire(date ?? nowInToronto().date);
        const dto = normalizeListLines(await client.getLineAll(dateWire));
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
