import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

import { MetrolinxError, toToolErrorResult } from "../errors.js";
import type { MetrolinxClient } from "../metrolinx/client.js";
import {
  findConsistByTrip,
  firstConsist,
  normalizeFleetConsist,
} from "../normalize/fleet-consist.js";
import {
  fleetConsistOutputShape,
  getFleetConsistInputShape,
} from "../schemas/fleet-consist.js";

export function registerGetFleetConsist(
  server: McpServer,
  client: MetrolinxClient,
): void {
  server.registerTool(
    "get_fleet_consist",
    {
      title: "Get fleet consist",
      description:
        "The physical car makeup of a GO train, looked up by trip number (via the fleet feed's remaining-trip data) or engine number.",
      inputSchema: getFleetConsistInputShape,
      outputSchema: fleetConsistOutputShape,
    },
    async ({ trip_number, engine_number }): Promise<CallToolResult> => {
      try {
        if (Boolean(trip_number) === Boolean(engine_number)) {
          throw new MetrolinxError(
            "invalid_input",
            "Provide exactly one of trip_number or engine_number, not both or neither.",
            false,
          );
        }

        const consist = engine_number
          ? firstConsist(await client.getFleetConsistByEngine(engine_number))
          : findConsistByTrip(await client.getFleetConsistAll(), trip_number!);

        if (!consist) {
          throw new MetrolinxError(
            "not_found",
            "No consist found for that trip/engine number. Verify via get_trip_status or get_vehicle_positions.",
            false,
          );
        }

        const dto = normalizeFleetConsist(consist);
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
