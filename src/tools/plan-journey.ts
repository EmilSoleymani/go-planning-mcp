import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

import { MetrolinxError, toToolErrorResult } from "../errors.js";
import type { MetrolinxClient } from "../metrolinx/client.js";
import { planItineraries } from "../normalize/journey.js";
import { buildStopNameIndex } from "../normalize/search-stops.js";
import type { PlanJourneyResult } from "../schemas/journey.js";
import {
  planJourneyInputShape,
  planJourneyOutputShape,
} from "../schemas/journey.js";
import { nowInToronto } from "../time.js";

export function registerPlanJourney(
  server: McpServer,
  client: MetrolinxClient,
): void {
  server.registerTool(
    "plan_journey",
    {
      title: "Plan a journey (raw)",
      description:
        "Fine-control trip planner for exact GO stop codes — no fuzzy name resolution, depart-after only. Use plan_trip for names or arrive-by search.",
      inputSchema: planJourneyInputShape,
      outputSchema: planJourneyOutputShape,
    },
    async ({
      from_stop_code,
      to_stop_code,
      date,
      time,
      max_results,
    }): Promise<CallToolResult> => {
      try {
        const stopAll = await client.getStopAll();
        const stopNames = buildStopNameIndex(stopAll);

        if (!stopNames.has(from_stop_code)) {
          throw new MetrolinxError(
            "not_found",
            `Unknown stop code "${from_stop_code}" for from_stop_code. Verify via search_stops.`,
            false,
          );
        }
        if (!stopNames.has(to_stop_code)) {
          throw new MetrolinxError(
            "not_found",
            `Unknown stop code "${to_stop_code}" for to_stop_code. Verify via search_stops.`,
            false,
          );
        }

        const itineraries = await planItineraries(
          client,
          {
            from: from_stop_code,
            to: to_stop_code,
            date: date ?? nowInToronto().date,
            time: time ?? nowInToronto().time,
            timeMode: "depart_after",
            maxResults: max_results ?? 3,
            // Raw mirror of one Schedule/Journey call — no hub-transfer
            // composition here (ADR 0002/0003); that's plan_trip's value-add.
            composeTransfers: false,
          },
          stopNames,
        );

        const dto: PlanJourneyResult = { itineraries };
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
