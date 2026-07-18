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

export function toStopMatch(entry: RawStopListEntry): StopMatch {
  return {
    stop_code: resolveStopCode(entry),
    stop_name: entry.LocationName,
    stop_type: stopType(entry.LocationType),
  };
}

// Full stop dataset in the search_stops match shape (tool-schemas spec §3,
// gotransit://stops resource) — every stop, unfiltered, sharing the same
// per-entry mapping as normalizeSearchStops so the two paths cannot drift.
export function normalizeAllStops(raw: RawStopAllResponse): SearchStopsResult {
  const matches = (raw.Stations?.Station ?? []).map(toStopMatch);
  return { matches, truncated: false, total_matched: matches.length };
}

function scoredMatches(
  entries: RawStopListEntry[],
  query: string,
  filter: "train" | "bus" | "any",
): { entry: RawStopListEntry; tier: number }[] {
  return entries
    .map((entry) => ({ entry, tier: matchTier(entry.LocationName, query) }))
    .filter(
      (scored): scored is { entry: RawStopListEntry; tier: number } =>
        scored.tier !== null,
    )
    .filter((scored) =>
      matchesFilter(stopType(scored.entry.LocationType), filter),
    );
}

export function normalizeSearchStops(
  raw: RawStopAllResponse,
  query: string,
  filter: "train" | "bus" | "any" = "any",
  limit = 10,
): SearchStopsResult {
  const scored = scoredMatches(raw.Stations?.Station ?? [], query, filter);
  scored.sort((a, b) => a.tier - b.tier);

  const totalMatched = scored.length;
  const matches: StopMatch[] = scored
    .slice(0, limit)
    .map(({ entry }) => toStopMatch(entry));

  return {
    matches,
    truncated: totalMatched > limit,
    total_matched: totalMatched,
  };
}

/** code -> stop_name, keyed by the unified stop_code (tool-schemas spec §1.4). */
export function buildStopNameIndex(
  raw: RawStopAllResponse,
): Map<string, string> {
  const index = new Map<string, string>();
  for (const entry of raw.Stations?.Station ?? []) {
    index.set(resolveStopCode(entry), entry.LocationName);
  }
  return index;
}

export type StopResolution =
  | { status: "resolved"; match: StopMatch }
  | { status: "ambiguous"; candidates: StopMatch[] }
  | { status: "not_found" };

/**
 * Resolves a `plan_trip` `from`/`to` input, which per tool-schemas spec §2.1
 * accepts either a station/stop name (fuzzy-matched, same matcher as
 * search_stops) or an exact stop code. An exact unified stop_code match
 * short-circuits the fuzzy search. Otherwise, only the best-scoring tier is
 * considered: a single best-tier match resolves; more than one (e.g. the
 * real "Oakville GO" name collision, tool-schemas spec §5) is ambiguous,
 * with candidates reproducible via search_stops for the same query.
 */
export function resolveStopByName(
  raw: RawStopAllResponse,
  query: string,
): StopResolution {
  const entries = raw.Stations?.Station ?? [];
  const trimmed = query.trim().toLowerCase();

  const codeMatch = entries.find(
    (entry) => resolveStopCode(entry).toLowerCase() === trimmed,
  );
  if (codeMatch) return { status: "resolved", match: toStopMatch(codeMatch) };

  const scored = scoredMatches(entries, query, "any");
  if (scored.length === 0) return { status: "not_found" };

  const bestTier = Math.min(...scored.map((s) => s.tier));
  const candidates = scored
    .filter((s) => s.tier === bestTier)
    .map(({ entry }) => toStopMatch(entry));

  if (candidates.length === 1)
    return { status: "resolved", match: candidates[0]! };
  return { status: "ambiguous", candidates };
}
