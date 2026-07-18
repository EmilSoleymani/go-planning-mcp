import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ReadResourceResult } from "@modelcontextprotocol/sdk/types.js";

import type { MetrolinxClient } from "./metrolinx/client.js";
import { normalizeListLines } from "./normalize/list-lines.js";
import { normalizeAllStops } from "./normalize/search-stops.js";
import { normalizeStopDetails } from "./normalize/stop-details.js";
import { dateToWire, nowInToronto } from "./time.js";

// Content is exactly the mirror tool's DTO (tool-schemas spec §3) — every
// handler below calls the same client method and normalizer its mirror tool
// does, so the two paths cannot drift.

function jsonResourceResult(uri: URL, dto: unknown): ReadResourceResult {
  return {
    contents: [
      {
        uri: uri.href,
        mimeType: "application/json",
        text: JSON.stringify(dto),
      },
    ],
  };
}

function firstValue(value: string | string[] | undefined): string {
  const resolved = Array.isArray(value) ? value[0] : value;
  if (resolved === undefined) {
    throw new Error("Missing resource template variable");
  }
  return resolved;
}

export function registerResources(
  server: McpServer,
  client: MetrolinxClient,
): void {
  server.registerResource(
    "stops",
    "gotransit://stops",
    {
      title: "All GO Transit stops",
      description:
        "Full stop dataset in the search_stops match shape (stop_code, stop_name, stop_type per stop).",
      mimeType: "application/json",
    },
    async (uri) =>
      jsonResourceResult(uri, normalizeAllStops(await client.getStopAll())),
  );

  server.registerResource(
    "stop-details",
    new ResourceTemplate("gotransit://stops/{code}", { list: undefined }),
    {
      title: "GO Transit stop details",
      description:
        "Details for one GO stop or station — the get_stop_details tool's DTO.",
      mimeType: "application/json",
    },
    async (uri, { code }) => {
      const stopCode = firstValue(code);
      const dto = normalizeStopDetails(await client.getStopDetails(stopCode));
      return jsonResourceResult(uri, dto);
    },
  );

  server.registerResource(
    "lines-for-date",
    new ResourceTemplate("gotransit://lines/{date}", { list: undefined }),
    {
      title: "GO Transit line roster",
      description:
        "GO Transit's line roster for a service day (YYYY-MM-DD) — the list_lines tool's DTO.",
      mimeType: "application/json",
    },
    async (uri, { date }) => {
      const dateWire = dateToWire(firstValue(date));
      const dto = normalizeListLines(await client.getLineAll(dateWire));
      return jsonResourceResult(uri, dto);
    },
  );

  server.registerResource(
    "lines-today",
    "gotransit://lines",
    {
      title: "Today's GO Transit line roster",
      description:
        "Static alias for gotransit://lines/{today} — browsable without constructing a dated URI.",
      mimeType: "application/json",
    },
    async (uri) => {
      const dateWire = dateToWire(nowInToronto().date);
      const dto = normalizeListLines(await client.getLineAll(dateWire));
      return jsonResourceResult(uri, dto);
    },
  );
}
