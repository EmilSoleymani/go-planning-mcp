import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

// Prompts compose tool calls into common flows (ticket 004 §6); they only
// render instructions for the model — the model is the one that calls the
// tools, so these handlers never touch MetrolinxClient (tool-schemas §4).

export function registerPrompts(server: McpServer): void {
  server.registerPrompt(
    "plan_a_trip",
    {
      title: "Plan a trip",
      description:
        "Resolve a trip by station name, plan it, and summarize it with fares and alerts.",
      argsSchema: {
        from: z
          .string()
          .describe("Starting station or stop name, e.g. 'Union'."),
        to: z
          .string()
          .describe("Destination station or stop name, e.g. 'Oakville'."),
        when: z
          .string()
          .optional()
          .describe(
            "Freeform departure or arrival time, e.g. 'tomorrow at 8am' or 'now'. Defaults to now.",
          ),
      },
    },
    ({ from, to, when }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: [
              `Plan a GO Transit trip from "${from}" to "${to}"${when ? `, ${when}` : ", leaving now"}.`,
              `First, normalize "${when ?? "now"}" yourself into a date (YYYY-MM-DD) and time (HH:MM, 24h, America/Toronto) — plan_trip's inputs are not freeform text. If the phrasing implies an arrival deadline (e.g. "by 9am"), pass the normalized time as arrive_by instead of a departure time.`,
              'Call plan_trip with from, to, and the normalized date/time. If the result has status: "ambiguous", show the user the candidates for each ambiguous field and ask them to pick before proceeding.',
              "Once you have an itinerary, call get_fares for the fare between the resolved stops and get_service_alerts for the line(s) used, so the summary covers cost and disruptions alongside the schedule.",
              "Summarize conversationally: departure/arrival times, transfers, fare, and any active alerts — and say plainly which stop names you assumed if resolution wasn't exact.",
            ].join("\n"),
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    "check_my_commute",
    {
      title: "Check my commute",
      description:
        "Next service, exceptions, and alerts for a home/work stop pair, direction inferred from time of day.",
      argsSchema: {
        home_stop: z.string().describe("Home station or stop name/code."),
        work_stop: z.string().describe("Work station or stop name/code."),
        direction: z
          .string()
          .optional()
          .describe(
            "'to work' or 'to home'. Omit to infer from the current time of day.",
          ),
      },
    },
    ({ home_stop, work_stop, direction }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: [
              `Check my GO Transit commute between "${home_stop}" (home) and "${work_stop}" (work).`,
              direction
                ? `Direction: ${direction}.`
                : 'No direction given — infer it from the current time of day: before roughly noon, assume "to work" (depart from home_stop toward work_stop); otherwise assume "to home" (depart from work_stop toward home_stop).',
              "Resolve both stop names to stop codes (search_stops if they aren't already codes), then call get_next_service for the departure stop in the inferred direction, plus get_service_exceptions and get_service_alerts for whatever line(s)/stop(s) are relevant.",
              "Summarize: the next departure(s) and any delay, plus any active exception or alert — call out clearly if the commute looks disrupted right now, not just what's scheduled.",
            ].join("\n"),
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    "service_status",
    {
      title: "Service status",
      description:
        "Network-wide (or single-line) GO Transit service status digest.",
      argsSchema: {
        line: z
          .string()
          .optional()
          .describe(
            "Line code or name to scope the digest to, e.g. 'LW'. Defaults to the whole network.",
          ),
      },
    },
    ({ line }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: [
              line
                ? `Give me the current GO Transit service status for the ${line} line.`
                : "Give me the current GO Transit service status across the whole network.",
              line
                ? `Call get_service_alerts and get_service_exceptions filtered to the ${line} line (resolve it via list_lines first if it's a name rather than a code).`
                : "Call get_service_alerts and get_service_exceptions with no line filter to cover the whole network.",
              'Summarize active service alerts and exceptions in plain language. If nothing is active, say so explicitly — a quick glance should answer "is anything wrong right now?".',
            ].join("\n"),
          },
        },
      ],
    }),
  );
}
