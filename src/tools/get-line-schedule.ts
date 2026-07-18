import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

import { MetrolinxError, toToolErrorResult } from "../errors.js";
import type { MetrolinxClient } from "../metrolinx/client.js";
import { normalizeLineSchedule } from "../normalize/line-schedule.js";
import {
  getLineScheduleInputShape,
  lineScheduleOutputShape,
} from "../schemas/line-schedule.js";
import { dateToWire, nowInToronto } from "../time.js";

export function registerGetLineSchedule(
  server: McpServer,
  client: MetrolinxClient,
): void {
  server.registerTool(
    "get_line_schedule",
    {
      title: "Get line schedule",
      description:
        "A GO Transit line's published schedule for a service day. Without stop_code, trip summaries only (first/last stop) to avoid dumping every stop of every trip; with stop_code, times at that stop.",
      inputSchema: getLineScheduleInputShape,
      outputSchema: lineScheduleOutputShape,
    },
    async ({
      line_code,
      direction,
      date,
      stop_code,
    }): Promise<CallToolResult> => {
      try {
        const dateWire = dateToWire(date ?? nowInToronto().date);
        const dto = normalizeLineSchedule(
          await client.getLineSchedule(dateWire, line_code, direction),
          stop_code,
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
