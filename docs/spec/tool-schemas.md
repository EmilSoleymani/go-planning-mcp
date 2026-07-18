# MCP Tool & Resource Schema Specification

Resolved by [ticket 006](../../.wayfinder/tickets/006-tool-schema-design.md) (grilled 2026-07-16). Builds on the 17-tool roster from ticket 004, the endpoint inventory from ticket 001, and the retry/caching decisions from ticket 005 / ADR 0001. This is the authoritative schema reference for implementation.

Notation: outputs are given in TypeScript-ish shorthand; `?` = optional. All schemas are implemented as Zod schemas (inputs **and** outputs) so `inputSchema`/`outputSchema` are generated from one source.

## 1. Cross-cutting conventions

### 1.1 Normalized DTOs — never passthrough

Every tool returns our own DTOs, not Metrolinx shapes:

- **snake_case field names**, uniform vocabulary across all tools: the same concept never appears under two names (`stop_code`, `stop_name`, `line_code`, `line_name`, `direction`, `trip_number`, `mode`).
- **Single-letter upstream enums expanded** to readable values (`ServiceType: "T"` → `mode: "train"`). Mappings for `DepartureStatus (E/C/A)` and `Status (S/M)` are best-effort from the Data Catalogue and **must be verified empirically during implementation**.
- **Metrolinx `Metadata` envelope stripped**; body-tunneled error codes are translated into the §1.5 taxonomy.
- **English by default; French opt-in per call**: tools whose output contains localized text take `lang?: "en" | "fr"` (default `"en"`). Bilingual field pairs collapse to one field per the requested language. Tools without localized text do not carry the parameter.
- GTFS-RT `route_id` / `trip_id` are mapped onto `line_code` / `trip_number` in normalized output.

### 1.2 Structured output on every tool

All 17 tools declare `outputSchema` and return `structuredContent` (MCP spec 2025-06-18+). The TypeScript SDK dually emits a serialized JSON text block for older clients. Zod input/output schemas live side by side per tool.

### 1.3 Timestamps & dates

- **Inputs**: `date` as `YYYY-MM-DD`, `time` as `HH:MM` (24h). Where sensible they are optional and default to *now in America/Toronto* — the server owns the clock.
- **Outputs**: full ISO 8601 with explicit offset, DST-aware (e.g. `2026-07-16T08:15:00-04:00`). Standalone dates stay `YYYY-MM-DD`. GTFS-RT Unix epochs are converted.
- **Service-day quirks** (past-midnight times like `25:30`) normalize to real clock times on the correct calendar date.
- The server converts to/from Metrolinx wire formats (`yyyymmdd`, `HHmm`) internally.

### 1.4 Identifiers

- **All IDs are strings**, never numbers (leading zeros; no arithmetic applies).
- **One unified `stop_code` concept**: station `LocationCode`s (`"UN"`) and 6-digit bus `PublicStopId`s travel in the same field; a `stop_type` accompanies where the distinction matters. The LLM never learns Metrolinx has two schemes.
- **Every ID parameter description carries an example and provenance**, e.g. `stop_code`: *"GO stop code, e.g. 'UN' (Union Station). Obtain via search_stops — do not guess."* Valid `direction` values come from `list_lines`; its description says so.

### 1.5 Errors

All operational failures are **in-result errors** (`isError: true`) with one normalized payload:

```json
{ "error": { "code": "rate_limited", "message": "<instruction for the LLM>", "retryable": false } }
```

Closed code enum:

| Code | Meaning | Typical message intent |
|---|---|---|
| `rate_limited` | Upstream 429 (never retried, per ADR 0001) | "Do not retry now; tell the user real-time data is temporarily unavailable." |
| `upstream_auth_failed` | Body-tunneled `Metadata.ErrorCode: "401"` | "Server misconfigured; operator must check METROLINX_API_KEY. Do not retry." |
| `upstream_unavailable` | Network/5xx after 2 retries exhausted | "Metrolinx API unreachable; try again later." |
| `not_found` | Unknown stop/trip/line code | "Verify the code via search_stops / list_lines." |
| `invalid_input` | Semantically invalid params that passed schema validation | Points at the offending parameter. |
| `upstream_error` | Catch-all for unclassifiable upstream failures | Generic. |

- **Messages are instructions, not diagnostics** — each tells the LLM what to do next.
- **Disambiguation is not an error**: an ambiguous `plan_trip` returns a *successful* result with `ambiguities` (§2.1). `isError` means "this call could not do its job."
- Protocol-level errors are reserved for malformed requests (SDK schema validation).

### 1.6 Pagination: none — filter-and-cap

- No cursors anywhere (upstream has none; pages over live snapshots would be fake).
- List-shaped tools take `limit?` with a documented default and max.
- Truncated outputs carry `truncated: true` and `total_matched: <n>`; output-schema descriptions instruct the LLM to **narrow the filter**, not request more.

Common envelope on list outputs (omitted from per-tool shapes below for brevity):

```ts
{ truncated: boolean, total_matched?: number }
```

## 2. Tool schemas

### 2.1 `plan_trip` — composed trip planner

Upstream: cached `Stop/All` (fuzzy name resolution) + `Schedule/Journey`.

Inputs:

| Param | Type | Req | Notes |
|---|---|---|---|
| `from` | string | ✓ | Station/stop name or stop code; fuzzy-resolved |
| `to` | string | ✓ | Same |
| `date` | `YYYY-MM-DD` | – | Default: today (Toronto) |
| `time` | `HH:MM` | – | Default: now (Toronto) |
| `time_mode` | `"depart_after" \| "arrive_by"` | – | Default `depart_after`. `arrive_by` is emulated: one `Schedule/Journey` call with `StartTime` back-shifted ~2h, filtered on arrival ≤ target, one retry with a wider window if empty |
| `max_results` | int | – | Default 3, max 10 (mirrors `MaxJourney`) |
| `lang` | `"en" \| "fr"` | – | Default `en` |

Output:

```ts
{
  status: "ok" | "ambiguous",
  // when ok:
  from?: { stop_code: string, stop_name: string },   // what fuzzy match resolved to —
  to?:   { stop_code: string, stop_name: string },   // always echoed so the LLM can say "I assumed Oakville GO"
  itineraries?: [{
    departure_time: string, arrival_time: string, duration_minutes: number,
    transfers: number, accessible: boolean,
    legs: [{
      mode: "train" | "bus", line_code: string, line_name: string, direction: string,
      from: { stop_code, stop_name, time }, to: { stop_code, stop_name, time },
      trip_number: string
    }]
  }],
  // when ambiguous:
  ambiguities?: [{
    field: "from" | "to", query: string,
    candidates: [{ stop_code, stop_name, city?, stop_type }]
  }]
}
```

Journey-only by design: fares and alerts stay in their own tools; the `plan_a_trip` prompt orchestrates the composition.

Amendment ([ADR 0002](../adr/0002-via-union-transfer-composition.md)): upstream `Schedule/Journey` turned out to be a direct-only planner (§5), so when the direct query is empty `plan_trip` composes one transfer via Union (`UN`) from two further journey calls — 10-minute minimum transfer buffer, worst case 3 upstream calls (6 under `arrive_by`). Composed results are ordinary multi-leg itineraries; no DTO change. `plan_journey` (§2.2) stays a raw single-call mirror. Bus-hub composition: issue #35 (needs grilling).

### 2.2 `plan_journey` — raw journey query

Upstream: `Schedule/Journey`. Fine-control mirror for exact stop codes; no fuzzy resolution, no `time_mode` (depart-after only — arrive-by is the composed tool's value-add). Unknown codes → `not_found`.

Inputs: `from_stop_code` (✓), `to_stop_code` (✓), `date?`, `time?`, `max_results?` (default 3, max 10).
Output: `{ itineraries: [...] }` — same itinerary DTO as `plan_trip`, no ambiguity branch.

### 2.3 `search_stops`

Upstream: cached `Stop/All`; same fuzzy matcher as `plan_trip`, so its candidates are always reproducible here.

Inputs: `query` (✓, name fragment), `stop_type?` (`"train" | "bus" | "any"`, default `any`), `limit?` (default 10, max 25).
Output: `{ matches: [{ stop_code, stop_name, stop_type, city? }] }` + truncation envelope.

### 2.4 `get_stop_details`

Upstream: `Stop/Details/{StopCode}`.

Inputs: `stop_code` (✓), `lang?`.
Output:

```ts
{
  stop_code, stop_name, city,
  coordinates: { lat: number, lon: number },
  served_by: { train: boolean, bus: boolean },
  facilities: string[],
  parking: [{ name: string, spaces: number, type: string }],
  accessibility_info?: string, boarding_info?: string, driving_directions?: string
}
```

### 2.5 `get_next_service`

Upstream: `Stop/NextService/{StopCode}`.

Inputs: `stop_code` (✓).
Output:

```ts
{
  departures: [{
    line_code, line_name, direction, mode: "train" | "bus",
    scheduled_time: string, expected_time: string,
    delay_minutes: number,            // derived server-side: expected − scheduled
    status: string,                    // expanded from E/C/A — verify mapping empirically
    platform: { scheduled?: string, actual?: string },
    trip_number
  }]
}
```

### 2.6 `get_stop_destinations`

Upstream: `Stop/Destinations/{StopCode}/{FromTime}/{ToTime}`.

Inputs: `stop_code` (✓), `from_time?` / `to_time?` (`HH:MM`; default now → now+4h).
Output: `{ destinations: [{ line_code, line_name, direction, destination_stop_code, destination_stop_name }] }`.

### 2.7 `get_union_departures`

Upstream: `ServiceUpdate/UnionDepartures/All`; `mode` filtered server-side.

Inputs: `mode?` (`"train" | "bus" | "any"`, default `any`).
Output: `{ departures: [{ trip_number, mode, service: string, time: string, platform?: string, stops_served: [{ stop_code, stop_name }] }] }`.

### 2.8 `get_service_alerts`

Upstream: all three alert feeds (`ServiceAlert`/`InformationAlert`/`MarketingAlert` `/All`), folded (ticket 004).

Inputs: `line?`, `stop?`, `category?` (`"service" | "information" | "marketing"`), `lang?`, `limit?`.
**Default when `category` omitted: service + information; marketing is opt-in only** (promos are noise for "is my train okay?").
Output:

```ts
{
  alerts: [{
    id: string, category: "service" | "information" | "marketing",
    status: "new" | "updated" | "corrected" | "final",   // from INIT/UPD/CORR/FINAL
    posted_at: string, subject: string, body: string,
    affected: { lines: string[], stops: [{ stop_code, stop_name }], trips: string[] }
  }]
}
```

### 2.9 `get_service_exceptions`

Upstream: `ServiceUpdate/Exceptions/{Train|Bus|All}`.

Inputs: `mode?` (`"train" | "bus" | "any"`, default `any`).
Output:

```ts
{
  exceptions: [{
    trip_number, trip_name, cancelled: boolean,
    affected_stops: [{ stop_code, stop_name, scheduled_time, cancelled: boolean, actual_time? }]
  }]
}
```

### 2.10 `get_service_guarantee`

Upstream: `ServiceUpdate/ServiceGuarantee/{TripNumber}/{OperationalDay}`.

Inputs: `trip_number` (✓), `date` (✓, `YYYY-MM-DD`), `lang?`.
Output: `{ eligible: boolean, stops: [{ stop_code, scope: string, reason: string }] }`.

### 2.11 `get_line_schedule` — two-mode, anti-dump

Upstream: `Schedule/Line/{Date}/{LineCode}/{LineDirection}`. A full service day (every trip × every stop) is a context bomb, so:

Inputs: `line_code` (✓), `direction` (✓, valid values from `list_lines`), `date?`, `stop_code?`.

- **Without `stop_code`** — trip summaries only: `{ trips: [{ trip_number, display, departs_first_stop: string, arrives_last_stop: string }] }`
- **With `stop_code`** — times at that stop: `{ trips: [{ trip_number, display, time: string }] }`

Full per-trip stop lists stay reachable via `get_trip_status`.

### 2.12 `list_lines`

Upstream: `Schedule/Line/All/{Date}`.

Inputs: `date?` (default today).
Output: `{ lines: [{ line_code, line_name, modes: ("train" | "bus")[], variants: [{ code, direction, display }] }] }`.
This is the provenance source for `direction` values; dependent tool descriptions point here.

### 2.13 `get_trip_status`

Upstream: `Schedule/Trip/{Date}/{TripNumber}`.

Inputs: `trip_number` (✓), `date?` (default today).
Output:

```ts
{
  trip_number, destination: string, status: string,
  position?: { lat: number, lon: number },
  stops: [{
    stop_code, stop_name,
    scheduled_arrival?, expected_arrival?, scheduled_departure?, expected_departure?,
    track: { scheduled?: string, actual?: string },
    status: string
  }]
}
```

### 2.14 `get_fares`

Upstream: `Fares/{From}/{To}[/{OperationalDay}]`. Metrolinx's triple nesting (category → ticket → fare) is **flattened to scannable rows**.

Inputs: `from_stop_code` (✓), `to_stop_code` (✓), `date?`.
Output: `{ fares: [{ rider: "adult" | "student" | "senior" | "child", method: "presto" | "paper", amount: number, category: string }] }`.

### 2.15 `get_vehicle_positions`

Upstream: `ServiceataGlance/{Buses|Trains|UPX}/All` merged with GTFS-RT `VehiclePosition` (ticket 004).

Inputs: `mode` (**✓**, `"train" | "bus" | "upx"`), `line_code?`, `trip_number?`, `limit?` (default 20, max 50).
Output:

```ts
{
  vehicles: [{
    trip_number, line_code, mode,
    position: { lat: number, lon: number },
    delay_minutes: number, occupancy_percent?: number,
    next_stop?: { stop_code, stop_name },
    in_motion: boolean, updated_at: string
  }]
}
```

### 2.16 `get_trip_updates`

Upstream: GTFS-RT `TripUpdates` feed, filtered server-side.

Inputs: `line_code?`, `trip_number?`, `stop_code?`, `limit?` (default 20, max 50).

**Unfiltered call = disruptions-only**: with no filters, return only trips with a material update — delay ≥ 3 minutes, or cancelled/skipped stops — so the bare call means *"what's off-plan right now?"*. With any filter, return everything matching, including on-time confirmations.

Output:

```ts
{
  updates: [{
    trip_number, line_code, direction?,
    status: "on_time" | "delayed" | "cancelled" | "modified",
    delay_minutes: number,
    stop_updates: [{ stop_code, scheduled_arrival?, expected_arrival?, scheduled_departure?, expected_departure?, status }],
    updated_at: string
  }]
}
```

### 2.17 `get_fleet_consist`

Upstream: `Fleet/Consist/All` (trip lookup via `RemainingTrip`) or `Fleet/Consist/Engine/{EngineNumber}`.

Inputs: exactly one of `trip_number` / `engine_number` (both or neither → `invalid_input`).
Output:

```ts
{
  engine_number: string, coach_count: number,
  cars: [{ type: string, order: number, number: string }],
  remaining_trips: [{ trip_number, line: string, start_time, end_time }]
}
```

## 3. Resources

Content is **exactly the mirror tool's DTO**, `mimeType: application/json`. Resource handlers and tools call the same internal client and serializer — the two paths cannot drift.

| URI | Content |
|---|---|
| `gotransit://stops` | Full stop dataset in the `search_stops` match shape |
| `gotransit://stops/{code}` | `get_stop_details` DTO (resource template) |
| `gotransit://lines/{date}` | `list_lines` DTO (resource template) |
| `gotransit://lines` | Static alias for "today" — browsable without constructing a dated URI |

## 4. Prompt arguments

MCP prompt arguments are strings by spec.

| Prompt | Arguments |
|---|---|
| `plan_a_trip` | `from` (✓), `to` (✓), `when?` — freeform ("tomorrow 8am"); prompt text instructs the model to normalize before calling `plan_trip` |
| `check_my_commute` | `home_stop` (✓), `work_stop` (✓), `direction?` — "to work"/"to home", default inferred from time of day |
| `service_status` | `line?` — default: whole network |

## 5. Implementation notes / open verifications

- **`Status (S/M)` — confirmed** against a live `Stop/NextService/UN` capture (32 lines, 31×`S`/1×`M`, issue #3): `S` = *scheduled* (published time, no live adjustment), `M` = *modified* (a real-time change has been applied to that line's data). Expand to `"scheduled"` / `"modified"`.
- **`DepartureStatus (E/C/A)` — `E`/`A` confirmed, `C` still inferred.** A same-day re-capture (20 min later, issue #3) caught a trip transitioning from `E` to `A` as it departed: `ScheduledDepartureTime`/`ComputedDepartureTime` moved into the past, real `Latitude`/`Longitude` appeared (vs. `-1`/`-1` placeholders while `E`), and `Status` flipped to `M`. Confirmed: `E` = *expected* (upcoming, not yet departed — placeholder position), `A` = *actual* (has departed — live position now tracked). `C` never appeared in either capture; best-effort inference carried over unconfirmed: `C` = *cancelled*. Re-check if a future capture (e.g. the weekly smoke run) ever observes it.
- **Timestamp format confirmed**: upstream sends naive `"YYYY-MM-DD HH:MM:SS"` strings (space-separated, no `T`, no timezone offset) — e.g. `"2026-07-17 17:29:00"`. There is no signal of which timezone this is in the wire format itself; treat it as America/Toronto local and attach the correct offset (DST-aware) when converting to output ISO 8601.
- **`Stop/Details` real field names confirmed** (differ from the pre-implementation guess): the stop code field is `Code` (not `LocationCode` — that name is `Stop/All`-only, for the *same* physical stop), the name field is `StopName`/`StopNameFr`, and `Latitude`/`Longitude` are numeric **strings**. There is **no `AccessibilityInfo` field upstream at all** — accessibility must be derived from `Facilities` entries whose `Code` is `WAT` or `UPWAT` (Wheelchair Accessible Train Service / UP Express variant). Parking lots are `Parkings` (not `ParkingLots`), fields `Name`/`NameFr`/`ParkSpots`/`Type`. Bilingual field pairs (`StopNameFr`, `BoardingInfoFr`, `DrivingDirectionsFr`, `Facilities[].DescriptionFr`) sometimes ship empty even when the English pair is populated — the `lang: "fr"` collapse must fall back to English when the French value is empty, not return `""`.
- **`Stop/All` confirms real name collisions**: "Oakville GO" appears twice — once as a Bus Stop (`LocationCode: "00137"`), once as a Train & Bus Station (`LocationCode: "OA"`) — concrete validation that `plan_trip`/`search_stops` disambiguation (§2.1, §2.3) is solving a real, observed case, not a hypothetical one.
- The `arrive_by` back-shift window (~2h, one widening retry) is a starting heuristic; tune against real journey data.
- **`Schedule/Journey` does not compose cross-line transfers — confirmed live (2026-07-18, issue #12)**: `Schedule/Journey/20260720/UI/EX/0800/3` (Unionville GO → Exhibition GO, a pair the official gotransit.com planner routes via a Union transfer) returns `ErrorCode: "200"` with `SchJourneys: []`. The endpoint's documented `Transfers[]`/`TransferLinks[]` fields exist but no multi-leg journey has ever been observed; treat the raw endpoint as a direct/single-corridor planner. The query-string endpoint variant (`Schedule/Journey/{Date}/{From}/{StartTime}/{MaxJourney}?ToStopCode=`) was also tested live (2026-07-18) and behaves identically — `SchJourneys: []` for the same pair. Resolution: `plan_trip` composes a via-Union transfer itself per [ADR 0002](../adr/0002-via-union-transfer-composition.md) (§2.1 amendment); `plan_journey` remains a raw mirror whose empty result on cross-line pairs is expected and documented in its output schema. Bus-hub composition beyond Union: issue #35.
- **Unknown stop code → `Metadata.ErrorCode: "204"` / `"No Content"` — confirmed live (issue #7)** across `Stop/Details`, `Stop/NextService`, and `Stop/Destinations` (data field `null` in all three). This is not a §1.5 failure code — it's Metrolinx's "no content for this identifier" signal, tunneled through the same mechanism as real errors. The client passes `"204"` through alongside `"200"`; each tool's own null-check on the data field produces the `not_found` in-result error instead.
- **`get_vehicle_positions`'s `occupancy_percent` is effectively unreachable with a standard registered key — confirmed live (issue #11/PR #26).** The GTFS-RT `VehiclePosition` endpoint that's actually documented as populating `occupancy_status`/`occupancy_percentage` is `Fleet/Occupancy/GtfsRT/Feed/VehiclePosition` (research handoff §2.7), not the plain `Gtfs/Feed/VehiclePosition` this project first (incorrectly) targeted. That Fleet-branded endpoint returns a genuine transport-level HTTP 401 for this project's key — see handoff-001 §2.7 for the full empirical note — while every other endpoint used across the tool roster, including the plain `Gtfs/Feed/VehiclePosition`, works fine with the same key. `get_vehicle_positions` now sources its base data from the plain feed; `occupancy_percent` stays in the DTO as optional ("populated when upstream provides them") but is expected to be absent for any consumer whose key has the same access level as this project's. Whether elevated Fleet access can be requested from Metrolinx is unconfirmed — flagged for a maintainer to follow up on, not blocking.
