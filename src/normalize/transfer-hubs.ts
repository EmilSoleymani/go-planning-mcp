// The curated composition-hub table (ADR 0003). Membership, walking pairs,
// coordinates, buffers, and priorities are curated facts — no API endpoint
// supplies them (Stop/All has no lat/lon; Stop/Destinations is a live
// window). Coordinates are approximations adequate for 5 km-bucket detour
// ranking; verify against Stop/Details during fixture capture. GO's
// terminal network changes on a timescale of years.

export interface TransferHub {
  name: string;
  /** Canonical journey-planning code (the rail side for walking pairs). */
  code: string;
  /** Walking-pair bus-terminal code, when distinct from `code` (ADR 0003). */
  busCode?: string;
  lat: number;
  lon: number;
  /** Minimum transfer minutes at this hub (default 10, ADR 0003). */
  bufferMinutes: number;
  /**
   * Buffer when a transfer crosses the walking pair (rail side <-> bus
   * side); defaults to bufferMinutes. Only Union overrides at launch.
   */
  pairBufferMinutes?: number;
  /** Tiebreaker within a 5 km detour bucket: lower wins. Union is 0. */
  priority: number;
}

export const TRANSFER_HUBS: TransferHub[] = [
  // Walking pairs (distinct codes, one physical place).
  // prettier-ignore
  { name: "Union Station", code: "UN", busCode: "02300", lat: 43.6453, lon: -79.3806, bufferMinutes: 10, pairBufferMinutes: 15, priority: 0 },
  // prettier-ignore
  { name: "Bramalea GO", code: "BE", busCode: "00225", lat: 43.7052, lon: -79.6934, bufferMinutes: 10, priority: 1 },
  // prettier-ignore
  { name: "Kipling GO", code: "KP", busCode: "02778", lat: 43.6365, lon: -79.5357, bufferMinutes: 10, priority: 1 },
  // prettier-ignore
  { name: "Langstaff GO / Richmond Hill Centre", code: "LA", busCode: "00350", lat: 43.8397, lon: -79.4245, bufferMinutes: 10, priority: 1 },
  // prettier-ignore
  { name: "Niagara Falls GO", code: "NI", busCode: "02408", lat: 43.109, lon: -79.0633, bufferMinutes: 10, priority: 3 },
  // Standalone bus terminals.
  // prettier-ignore
  { name: "Square One Bus Terminal", code: "00132", lat: 43.5933, lon: -79.6441, bufferMinutes: 10, priority: 1 },
  // prettier-ignore
  { name: "Hwy 407 Bus Terminal", code: "02673", lat: 43.7834, lon: -79.5236, bufferMinutes: 10, priority: 1 },
  // prettier-ignore
  { name: "Finch Bus Terminal", code: "00013", lat: 43.7805, lon: -79.4157, bufferMinutes: 10, priority: 1 },
  // prettier-ignore
  { name: "Scarborough Centre Bus Terminal", code: "02816", lat: 43.7745, lon: -79.2543, bufferMinutes: 10, priority: 1 },
  // prettier-ignore
  { name: "Yorkdale Bus Terminal", code: "00019", lat: 43.7247, lon: -79.4523, bufferMinutes: 10, priority: 1 },
  // prettier-ignore
  { name: "York Mills Bus Terminal", code: "00011", lat: 43.7446, lon: -79.4066, bufferMinutes: 10, priority: 1 },
  // Train & Bus stations with cross-corridor interchange (single code).
  // prettier-ignore
  { name: "Oakville GO", code: "OA", lat: 43.4553, lon: -79.6825, bufferMinutes: 10, priority: 2 },
  // prettier-ignore
  { name: "Burlington GO", code: "BU", lat: 43.3392, lon: -79.809, bufferMinutes: 10, priority: 2 },
  // prettier-ignore
  { name: "Aldershot GO", code: "AL", lat: 43.3133, lon: -79.8555, bufferMinutes: 10, priority: 2 },
  // prettier-ignore
  { name: "Hamilton GO Centre", code: "HA", lat: 43.253, lon: -79.8696, bufferMinutes: 10, priority: 2 },
  // prettier-ignore
  { name: "Milton GO", code: "ML", lat: 43.5233, lon: -79.8771, bufferMinutes: 10, priority: 2 },
  // prettier-ignore
  { name: "Guelph Central GO", code: "GL", lat: 43.5448, lon: -80.2482, bufferMinutes: 10, priority: 2 },
  // prettier-ignore
  { name: "Kitchener GO", code: "KI", lat: 43.4556, lon: -80.4937, bufferMinutes: 10, priority: 2 },
  // prettier-ignore
  { name: "Whitby GO", code: "WH", lat: 43.865, lon: -78.9403, bufferMinutes: 10, priority: 2 },
  // prettier-ignore
  { name: "Durham College Oshawa GO", code: "OS", lat: 43.87, lon: -78.846, bufferMinutes: 10, priority: 2 },
  // prettier-ignore
  { name: "Aurora GO", code: "AU", lat: 43.9976, lon: -79.463, bufferMinutes: 10, priority: 2 },
  // prettier-ignore
  { name: "Newmarket GO", code: "NE", lat: 44.0562, lon: -79.459, bufferMinutes: 10, priority: 2 },
  // prettier-ignore
  { name: "Unionville GO", code: "UI", lat: 43.8524, lon: -79.312, bufferMinutes: 10, priority: 2 },
  // prettier-ignore
  { name: "Pearson Airport Terminal 1", code: "PA", lat: 43.6817, lon: -79.611, bufferMinutes: 10, priority: 2 },
];

export interface HubEndpoint {
  code: string;
  lat: number;
  lon: number;
}

// Detour ratio cutoff (ADR 0003): hubs where from->hub->to exceeds 1.6x the
// direct distance are excluded before any probing. Tunable.
const DETOUR_RATIO_CUTOFF = 1.6;

// Geometric precision below ~5 km is noise for transit detours; within a
// bucket, curated priority (network knowledge) outranks raw geometry.
const DETOUR_BUCKET_KM = 5;

const EARTH_RADIUS_KM = 6371;

function haversineKm(
  aLat: number,
  aLon: number,
  bLat: number,
  bLon: number,
): number {
  const toRad = (deg: number): number => (deg * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

export interface EndpointModes {
  isTrain: boolean;
  isBus: boolean;
}

export interface TransferLegPlan {
  inboundToCode: string;
  onwardFromCode: string;
  bufferMinutes: number;
}

/**
 * Which hub code each composed leg targets, and the buffer between them.
 * A rail-capable endpoint's leg meets a walking-pair hub on the rail side,
 * a bus-only endpoint's on the bus side (heuristic — we cannot know a leg's
 * mode before querying it); crossing the pair costs pairBufferMinutes.
 */
export function planHubLegs(
  hub: TransferHub,
  from: EndpointModes,
  to: EndpointModes,
): TransferLegPlan {
  const sideCode = (endpoint: EndpointModes): string =>
    hub.busCode !== undefined && endpoint.isBus && !endpoint.isTrain
      ? hub.busCode
      : hub.code;
  const inboundToCode = sideCode(from);
  const onwardFromCode = sideCode(to);
  return {
    inboundToCode,
    onwardFromCode,
    bufferMinutes:
      inboundToCode === onwardFromCode
        ? hub.bufferMinutes
        : (hub.pairBufferMinutes ?? hub.bufferMinutes),
  };
}

/**
 * The hub ladder (ADR 0003): candidate hubs ranked by geometric detour
 * `dist(from, hub) + dist(hub, to)`, bucketed to 5 km with curated priority
 * as tiebreaker, hubs beyond the 1.6x detour-ratio cutoff or matching an
 * endpoint excluded.
 */
export function rankHubs(
  from: HubEndpoint,
  to: HubEndpoint,
  hubs: TransferHub[] = TRANSFER_HUBS,
): TransferHub[] {
  const directKm = haversineKm(from.lat, from.lon, to.lat, to.lon);
  const endpointCodes = new Set([from.code, to.code]);

  return hubs
    .filter(
      (hub) =>
        !endpointCodes.has(hub.code) &&
        (hub.busCode === undefined || !endpointCodes.has(hub.busCode)),
    )
    .map((hub) => ({
      hub,
      detourKm:
        haversineKm(from.lat, from.lon, hub.lat, hub.lon) +
        haversineKm(hub.lat, hub.lon, to.lat, to.lon),
    }))
    .filter(({ detourKm }) => detourKm <= directKm * DETOUR_RATIO_CUTOFF)
    .sort((a, b) => {
      const bucketA = Math.floor(a.detourKm / DETOUR_BUCKET_KM);
      const bucketB = Math.floor(b.detourKm / DETOUR_BUCKET_KM);
      if (bucketA !== bucketB) return bucketA - bucketB;
      if (a.hub.priority !== b.hub.priority)
        return a.hub.priority - b.hub.priority;
      return a.detourKm - b.detourKm;
    })
    .map(({ hub }) => hub);
}
