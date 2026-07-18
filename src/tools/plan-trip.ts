import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

import { MetrolinxError, toToolErrorResult } from "../errors.js";
import type { MetrolinxClient } from "../metrolinx/client.js";
import { planItineraries } from "../normalize/journey.js";
import {
  buildStopNameIndex,
  resolveStopByName,
} from "../normalize/search-stops.js";
import type { Ambiguity, PlanTripResult } from "../schemas/journey.js";
import { planTripInputShape, planTripOutputShape } from "../schemas/journey.js";
import { nowInToronto } from "../time.js";

export function registerPlanTrip(
  server: McpServer,
  client: MetrolinxClient,
): void {
  server.registerTool(
    "plan_trip",
    {
      title: "Plan a trip",
      description:
        "Plan a GO Transit trip between two stations/stops by name (fuzzy-resolved) or stop code, returning itineraries with legs, transfers, and accessibility. Ambiguous names return candidates instead of an error.",
      inputSchema: planTripInputShape,
      outputSchema: planTripOutputShape,
    },
    async ({
      from,
      to,
      date,
      time,
      time_mode,
      max_results,
    }): Promise<CallToolResult> => {
      try {
        const stopAll = await client.getStopAll();

        const fromResolution = resolveStopByName(stopAll, from);
        if (fromResolution.status === "not_found") {
          throw new MetrolinxError(
            "not_found",
            `No stop matches "${from}". Verify the name via search_stops.`,
            false,
          );
        }
        const toResolution = resolveStopByName(stopAll, to);
        if (toResolution.status === "not_found") {
          throw new MetrolinxError(
            "not_found",
            `No stop matches "${to}". Verify the name via search_stops.`,
            false,
          );
        }

        if (
          fromResolution.status === "ambiguous" ||
          toResolution.status === "ambiguous"
        ) {
          const ambiguities: Ambiguity[] = [];
          if (fromResolution.status === "ambiguous") {
            ambiguities.push({
              field: "from",
              query: from,
              candidates: fromResolution.candidates,
            });
          }
          if (toResolution.status === "ambiguous") {
            ambiguities.push({
              field: "to",
              query: to,
              candidates: toResolution.candidates,
            });
          }
          const dto: PlanTripResult = { status: "ambiguous", ambiguities };
          return {
            content: [{ type: "text", text: JSON.stringify(dto) }],
            structuredContent: dto,
          };
        }

        // Neither resolution is "not_found" (handled above) nor "ambiguous"
        // (handled above, with a return) — both are "resolved" here.
        const fromMatch = fromResolution.match;
        const toMatch = toResolution.match;

        const stopNames = buildStopNameIndex(stopAll);
        const resolvedDate = date ?? nowInToronto().date;
        const resolvedTime = time ?? nowInToronto().time;

        const itineraries = await planItineraries(
          client,
          fromMatch.stop_code,
          toMatch.stop_code,
          resolvedDate,
          resolvedTime,
          time_mode ?? "depart_after",
          max_results ?? 3,
          stopNames,
        );

        const dto: PlanTripResult = {
          status: "ok",
          from: {
            stop_code: fromMatch.stop_code,
            stop_name: fromMatch.stop_name,
          },
          to: { stop_code: toMatch.stop_code, stop_name: toMatch.stop_name },
          itineraries,
        };
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
