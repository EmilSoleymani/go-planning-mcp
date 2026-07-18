import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

import { MetrolinxError, toToolErrorResult } from "../errors.js";
import type { MetrolinxClient } from "../metrolinx/client.js";
import { normalizeVehiclePositions } from "../normalize/vehicle-positions.js";
import {
  getVehiclePositionsInputShape,
  vehiclePositionsOutputShape,
} from "../schemas/vehicle-positions.js";

export function registerGetVehiclePositions(
  server: McpServer,
  client: MetrolinxClient,
): void {
  server.registerTool(
    "get_vehicle_positions",
    {
      title: "Get vehicle positions",
      description:
        "Live positions, delay, and occupancy for GO vehicles of one mode (train, bus, or UPX).",
      inputSchema: getVehiclePositionsInputShape,
      outputSchema: vehiclePositionsOutputShape,
    },
    async ({
      mode,
      line_code,
      trip_number,
      limit,
    }): Promise<CallToolResult> => {
      try {
        const [glance, positions, stopAll] = await Promise.all([
          client.getServiceGlance(mode),
          client.getVehiclePositions(),
          client.getStopAll(),
        ]);
        const dto = normalizeVehiclePositions(
          glance,
          positions,
          stopAll,
          mode,
          { line_code, trip_number },
          limit ?? 20,
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
