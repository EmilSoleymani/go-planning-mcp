import { MetrolinxError } from "../errors.js";
import type {
  RawDestinationLine,
  RawStopDestinationsResponse,
} from "../metrolinx/types.js";
import type {
  Destination,
  StopDestinationsResult,
} from "../schemas/stop-destinations.js";

// GO Transit's known line roster. Stop/Destinations carries no line-name
// field (only Code/Display/Direction/DestinationStop) — best-effort static
// map, same pattern as the enum-expansion tables elsewhere; falls back to
// the raw code for anything not yet seen.
const LINE_NAMES: Record<string, string> = {
  LW: "Lakeshore West",
  LE: "Lakeshore East",
  MI: "Milton",
  GT: "Kitchener",
  RH: "Richmond Hill",
  BR: "Barrie",
  ST: "Stouffville",
  UP: "UP Express",
};

// Display is "{Code} - {destination name}" (confirmed live, issue #7); the
// destination name has no separate field, so it's recovered by stripping
// the line-code prefix.
function destinationStopName(line: RawDestinationLine): string {
  const prefix = `${line.Code} - `;
  return line.Display.startsWith(prefix)
    ? line.Display.slice(prefix.length)
    : line.Display;
}

export function normalizeStopDestinations(
  raw: RawStopDestinationsResponse,
): StopDestinationsResult {
  const stop = raw.Stop;
  if (!stop) {
    throw new MetrolinxError(
      "not_found",
      "No stop matches that code. Verify the code via search_stops.",
      false,
    );
  }

  // The upstream feed repeats one entry per departure in the window rather
  // than once per distinct destination (confirmed live) — dedupe down to
  // unique line/direction/destination combinations.
  const seen = new Set<string>();
  const destinations: Destination[] = [];
  for (const line of stop.Line ?? []) {
    const key = `${line.Code}|${line.Direction}|${line.DestinationStop}`;
    if (seen.has(key)) continue;
    seen.add(key);
    destinations.push({
      line_code: line.Code,
      line_name: LINE_NAMES[line.Code] ?? line.Code,
      direction: line.Direction,
      destination_stop_code: line.DestinationStop,
      destination_stop_name: destinationStopName(line),
    });
  }

  return {
    destinations,
    truncated: false,
    total_matched: destinations.length,
  };
}
