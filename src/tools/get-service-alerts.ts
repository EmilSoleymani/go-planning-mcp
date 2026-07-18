import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

import { MetrolinxError, toToolErrorResult } from "../errors.js";
import type { MetrolinxClient } from "../metrolinx/client.js";
import type { AlertFeed } from "../normalize/service-alerts.js";
import { normalizeServiceAlerts } from "../normalize/service-alerts.js";
import type { Alert } from "../schemas/service-alerts.js";
import {
  getServiceAlertsInputShape,
  serviceAlertsOutputShape,
} from "../schemas/service-alerts.js";

async function fetchFeed(
  client: MetrolinxClient,
  category: Alert["category"],
): Promise<AlertFeed> {
  const raw =
    category === "service"
      ? await client.getServiceAlerts()
      : category === "information"
        ? await client.getInformationAlerts()
        : await client.getMarketingAlerts();
  return { category, raw };
}

export function registerGetServiceAlerts(
  server: McpServer,
  client: MetrolinxClient,
): void {
  server.registerTool(
    "get_service_alerts",
    {
      title: "Get service alerts",
      description:
        "Folded GO Transit service/information/marketing alerts. Defaults to service + information; pass category: 'marketing' to opt into promos.",
      inputSchema: getServiceAlertsInputShape,
      outputSchema: serviceAlertsOutputShape,
    },
    async ({ line, stop, category, lang, limit }): Promise<CallToolResult> => {
      try {
        // Default when category is omitted: service + information —
        // marketing is opt-in only (tool-schemas spec §2.8). Only fetch the
        // upstream feed(s) actually in scope.
        const categories: Alert["category"][] = category
          ? [category]
          : ["service", "information"];
        const feeds = await Promise.all(
          categories.map((c) => fetchFeed(client, c)),
        );
        const dto = normalizeServiceAlerts(feeds, {
          ...(line !== undefined ? { line } : {}),
          ...(stop !== undefined ? { stop } : {}),
          ...(limit !== undefined ? { limit } : {}),
          ...(lang !== undefined ? { lang } : {}),
        });
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
