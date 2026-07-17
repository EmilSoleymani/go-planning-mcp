import type {
  RawStopAllResponse,
  RawStopListEntry,
} from "../metrolinx/types.js";
import type { SearchStopsResult, StopMatch } from "../schemas/search-stops.js";

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Match tiers, best first — exact, prefix, then substring anywhere. Both
// entries in an ambiguous name collision (e.g. "Oakville GO" as a Bus Stop
// and as a Train & Bus Station) land in the same tier, so both surface as
// candidates — required for plan_trip's later disambiguation reuse.
function matchTier(name: string, query: string): number | null {
  const n = normalizeText(name);
  const q = normalizeText(query);
  if (!q) return null;
  if (n === q) return 0;
  if (n.startsWith(q)) return 1;
  if (n.includes(q)) return 2;
  return null;
}

export function stopType(locationType: string): "train" | "bus" | "both" {
  if (locationType === "Train & Bus Station") return "both";
  if (locationType === "Train Station") return "train";
  return "bus";
}

function matchesFilter(
  type: "train" | "bus" | "both",
  filter: "train" | "bus" | "any",
): boolean {
  return filter === "any" || type === filter || type === "both";
}

// Station LocationCodes ("UN", "OA") are what Stop/Details and
// Stop/NextService accept for train (and mixed) stops. Pure bus stops have
// no such alpha code — their unified stop_code is the 6-digit PublicStopId
// instead (tool-schemas spec §1.4). Unconfirmed against a live Stop/Details
// call on a bus-only stop; revisit if that ever surfaces a mismatch.
export function resolveStopCode(entry: RawStopListEntry): string {
  return entry.LocationType.includes("Train")
    ? entry.LocationCode
    : entry.PublicStopId;
}

export function normalizeSearchStops(
  raw: RawStopAllResponse,
  query: string,
  filter: "train" | "bus" | "any" = "any",
  limit = 10,
): SearchStopsResult {
  const entries = raw.Stations?.Station ?? [];

  const scored = entries
    .map((entry) => ({ entry, tier: matchTier(entry.LocationName, query) }))
    .filter(
      (scored): scored is { entry: RawStopListEntry; tier: number } =>
        scored.tier !== null,
    )
    .filter((scored) =>
      matchesFilter(stopType(scored.entry.LocationType), filter),
    );

  scored.sort((a, b) => a.tier - b.tier);

  const totalMatched = scored.length;
  const matches: StopMatch[] = scored.slice(0, limit).map(({ entry }) => ({
    stop_code: resolveStopCode(entry),
    stop_name: entry.LocationName,
    stop_type: stopType(entry.LocationType),
  }));

  return {
    matches,
    truncated: totalMatched > limit,
    total_matched: totalMatched,
  };
}
