# Tools Reference

Full reference for every MCP tool registered by go-transit-mcp. This is user-facing documentation for someone integrating against a specific tool — for the design rationale behind these shapes, see [docs/spec/tool-schemas.md](spec/tool-schemas.md).

Conventions that apply across all tools:

- All fields are `snake_case`; the server never passes through raw Metrolinx shapes.
- All IDs (`stop_code`, `line_code`, `trip_number`, `engine_number`) are strings, even when they look numeric.
- Output timestamps are full ISO 8601 with a Toronto (`America/Toronto`) offset, e.g. `2026-07-16T08:15:00-04:00`. Input dates are `YYYY-MM-DD` and input times are `HH:MM` (24h); both default to "now in Toronto" when omitted.
- Failures are returned as in-result errors (`isError: true`), not protocol errors: `{ "error": { "code": "not_found" | "invalid_input" | "rate_limited" | "upstream_auth_failed" | "upstream_unavailable" | "upstream_error", "message": "...", "retryable": boolean } }`. The message is written as an instruction for the calling LLM, not a diagnostic.
- List-shaped outputs carry `truncated: boolean` and `total_matched?: number` instead of pagination — a `truncated: true` result means narrow your filter, not "fetch the next page".
- Any `stop_code` you pass in must come from `search_stops` (or another tool's output) — never guess one.

## Contents

- [Trip planning](#trip-planning) — `plan_trip`, `plan_journey`
- [Stops](#stops) — `search_stops`, `get_stop_details`, `get_next_service`, `get_stop_destinations`
- [Schedules & lines](#schedules--lines) — `list_lines`, `get_line_schedule`, `get_trip_status`
- [Service updates](#service-updates) — `get_service_alerts`, `get_service_exceptions`, `get_service_guarantee`, `get_union_departures`
- [Fares & fleet](#fares--fleet) — `get_fares`, `get_fleet_consist`
- [Real-time (GTFS-RT)](#real-time-gtfs-rt) — `get_vehicle_positions`, `get_trip_updates`

---

## Trip planning

### `plan_trip`

Plan a GO Transit trip between two stations/stops by name (fuzzy-resolved) or stop code. Returns itineraries with legs, transfers, and accessibility. Trips that have no direct journey are composed automatically with one transfer at the best-ranked composition hub — Union, a major bus terminal (Square One, Hwy 407, Scarborough Centre, …), or an interchange station (ADR 0003). Composed itineraries carry `composed: true`: the pairing is planner-suggested, not a GO-published connection. An ambiguous name is not an error — it comes back as a list of candidates to disambiguate.

**Inputs**

| Param | Type | Required | Default | Notes |
|---|---|---|---|---|
| `from` | string | ✓ | – | Origin station/stop name (fuzzy-matched, e.g. `"union"`) or exact stop code. |
| `to` | string | ✓ | – | Destination station/stop name (fuzzy-matched, e.g. `"oakville"`) or exact stop code. |
| `date` | `YYYY-MM-DD` | | today (Toronto) | Travel date. |
| `time` | `HH:MM` | | now (Toronto) | Departure or arrival time, per `time_mode`. |
| `time_mode` | `"depart_after" \| "arrive_by"` | | `"depart_after"` | `arrive_by` is emulated: one journey query with the start time back-shifted ~2h, results filtered on arrival ≤ target, and one retry with a wider window if that comes back empty. |
| `max_results` | integer | | 3 | Max 10 (mirrors Metrolinx's `MaxJourney`). |
| `lang` | `"en" \| "fr"` | | `"en"` | Response language. |

**Output** — when `status: "ok"`:

```json
{
  "status": "ok",
  "from": { "stop_code": "UN", "stop_name": "Union Station" },
  "to": { "stop_code": "OA", "stop_name": "Oakville GO" },
  "itineraries": [
    {
      "departure_time": "2026-07-20T08:12:00-04:00",
      "arrival_time": "2026-07-20T08:58:00-04:00",
      "duration_minutes": 46,
      "transfers": 0,
      "accessible": true,
      "legs": [
        {
          "mode": "train",
          "line_code": "LW",
          "line_name": "Lakeshore West",
          "direction": "W",
          "from": { "stop_code": "UN", "stop_name": "Union Station", "time": "2026-07-20T08:12:00-04:00" },
          "to": { "stop_code": "OA", "stop_name": "Oakville GO", "time": "2026-07-20T08:58:00-04:00" },
          "trip_number": "1004"
        }
      ]
    }
  ]
}
```

`from`/`to` are always echoed so the LLM can confirm what it assumed (e.g. "I assumed Oakville GO station, not the bus stop"). An empty `itineraries` array means nothing was found in the requested window, even after probing up to three transfer hubs — try a different time/date. Composition is capped at one transfer (ADR 0003); journeys genuinely needing two transfers are out of scope.

When `status: "ambiguous"`, `itineraries`/`from`/`to` are absent and `ambiguities` is present instead:

```json
{
  "status": "ambiguous",
  "ambiguities": [
    {
      "field": "to",
      "query": "oakville",
      "candidates": [
        { "stop_code": "OA", "stop_name": "Oakville GO", "stop_type": "both", "city": "Oakville" },
        { "stop_code": "00137", "stop_name": "Oakville GO", "stop_type": "bus", "city": "Oakville" }
      ]
    }
  ]
}
```

Ask the user to pick a candidate (by `stop_code`), then retry.

### `plan_journey`

Fine-control mirror of `plan_trip` for exact stop codes: no fuzzy name resolution, no `arrive_by` (depart-after only), and no automatic Union-transfer composition — it is a raw single-call mirror of Metrolinx's journey planner. Use `plan_trip` when you have names, want `arrive_by`, or want the server to compose a cross-line transfer.

**Inputs**

| Param | Type | Required | Default | Notes |
|---|---|---|---|---|
| `from_stop_code` | string | ✓ | – | Exact GO stop code, e.g. `"UN"`. Obtain via `search_stops`. |
| `to_stop_code` | string | ✓ | – | Exact GO stop code, e.g. `"OA"`. Obtain via `search_stops`. |
| `date` | `YYYY-MM-DD` | | today (Toronto) | Travel date. |
| `time` | `HH:MM` | | now (Toronto) | Depart-after time. |
| `max_results` | integer | | 3 | Max 10. |

An unrecognized `from_stop_code`/`to_stop_code` returns a `not_found` in-result error rather than an empty itinerary list.

**Output**

```json
{ "itineraries": [ /* same itinerary shape as plan_trip */ ] }
```

An empty `itineraries` array on a cross-line pair is expected (Metrolinx's endpoint doesn't compose transfers) — use `plan_trip` for that.

---

## Stops

### `search_stops`

Fuzzy search for GO Transit stops and stations by name fragment (e.g. `"union"`, `"oakville"`). This is the tool to call before passing any `stop_code` to another tool.

**Inputs**

| Param | Type | Required | Default | Notes |
|---|---|---|---|---|
| `query` | string | ✓ | – | Name fragment, e.g. `"union"` or `"oakville"`. |
| `stop_type` | `"train" \| "bus" \| "any"` | | `"any"` | Filter by service type. |
| `limit` | integer | | 10 | Max 25. |

**Output**

```json
{
  "matches": [
    { "stop_code": "UN", "stop_name": "Union Station", "stop_type": "both", "city": "Toronto" },
    { "stop_code": "OA", "stop_name": "Oakville GO", "stop_type": "both", "city": "Oakville" }
  ],
  "truncated": false,
  "total_matched": 2
}
```

Real name collisions exist — e.g. "Oakville GO" is both a train/bus station (`OA`) and a separate bus-only stop (`00137`); `stop_type` disambiguates.

### `get_stop_details`

Details for one GO stop or station: location, which modes serve it, facilities, parking, and accessibility.

**Inputs**

| Param | Type | Required | Default | Notes |
|---|---|---|---|---|
| `stop_code` | string | ✓ | – | GO stop code, e.g. `"UN"`. Obtain via `search_stops`. |
| `lang` | `"en" \| "fr"` | | `"en"` | Response language. French fields fall back to English when empty upstream. |

**Output**

```json
{
  "stop_code": "UN",
  "stop_name": "Union Station",
  "city": "Toronto",
  "coordinates": { "lat": 43.645126, "lon": -79.380875 },
  "served_by": { "train": true, "bus": true },
  "facilities": ["Washroom", "Wheelchair Accessible Train Service"],
  "parking": [{ "name": "Union Station Parking", "spaces": 0, "type": "Paid" }],
  "accessibility_info": "Fully accessible",
  "boarding_info": "Boarding at all platforms",
  "driving_directions": "Access via Front Street"
}
```

Unknown `stop_code` returns a `not_found` in-result error.

### `get_next_service`

Live upcoming departures for one GO Transit stop, with delay and status.

**Inputs**

| Param | Type | Required | Default | Notes |
|---|---|---|---|---|
| `stop_code` | string | ✓ | – | GO stop code, e.g. `"UN"`. Obtain via `search_stops`. |

**Output**

```json
{
  "departures": [
    {
      "line_code": "LW",
      "line_name": "Lakeshore West",
      "direction": "W",
      "mode": "train",
      "scheduled_time": "2026-07-19T08:12:00-04:00",
      "expected_time": "2026-07-19T08:15:00-04:00",
      "delay_minutes": 3,
      "status": "modified",
      "platform": { "scheduled": "4", "actual": "4" },
      "trip_number": "1004"
    }
  ],
  "truncated": false,
  "total_matched": 1
}
```

`status` is one of `"scheduled"` (published time, no live adjustment) or `"modified"` (a real-time change has been applied).

### `get_stop_destinations`

Where a GO Transit stop's services go within a time window.

**Inputs**

| Param | Type | Required | Default | Notes |
|---|---|---|---|---|
| `stop_code` | string | ✓ | – | GO stop code, e.g. `"UN"`. Obtain via `search_stops`. |
| `from_time` | `HH:MM` | | now (Toronto) | Window start. |
| `to_time` | `HH:MM` | | `from_time` + 4h | Window end. |

**Output**

```json
{
  "destinations": [
    { "line_code": "LW", "line_name": "Lakeshore West", "direction": "W", "destination_stop_code": "AL", "destination_stop_name": "Aldershot GO" }
  ],
  "truncated": false,
  "total_matched": 1
}
```

---

## Schedules & lines

### `list_lines`

GO Transit's line roster for a service day, including the valid direction codes to pass to `get_line_schedule`.

**Inputs**

| Param | Type | Required | Default | Notes |
|---|---|---|---|---|
| `date` | `YYYY-MM-DD` | | today (Toronto) | Service day. |

**Output**

```json
{
  "lines": [
    {
      "line_code": "LW",
      "line_name": "Lakeshore West",
      "modes": ["train"],
      "variants": [
        { "code": "LW-E", "direction": "E", "display": "Eastbound to Union" },
        { "code": "LW-W", "direction": "W", "display": "Westbound to Aldershot" }
      ]
    }
  ],
  "truncated": false,
  "total_matched": 1
}
```

This is the provenance source for the `direction` values used by `get_line_schedule` — don't guess a direction code, read it from here first.

### `get_line_schedule`

A GO Transit line's published schedule for a service day. Two-mode to avoid dumping a full day's stop-by-stop times for every trip:

- **Without `stop_code`** — trip summaries only (first/last stop times).
- **With `stop_code`** — just the times at that one stop.

**Inputs**

| Param | Type | Required | Default | Notes |
|---|---|---|---|---|
| `line_code` | string | ✓ | – | GO line code, e.g. `"LW"`. From `list_lines`. |
| `direction` | string | ✓ | – | Line direction code, e.g. `"E"`. Valid values from `list_lines`. |
| `date` | `YYYY-MM-DD` | | today (Toronto) | Service day. |
| `stop_code` | string | | – | GO stop code to get times at that stop. Obtain via `search_stops`. |

**Output** — without `stop_code`:

```json
{
  "trips": [
    { "trip_number": "1004", "display": "1004 - Union to Aldershot", "departs_first_stop": "2026-07-19T08:12:00-04:00", "arrives_last_stop": "2026-07-19T09:05:00-04:00" }
  ],
  "truncated": false,
  "total_matched": 1
}
```

With `stop_code`, each trip has a `time` field instead of `departs_first_stop`/`arrives_last_stop`. For the full per-trip stop list, use `get_trip_status`.

### `get_trip_status`

Live stop-by-stop status for a single GO Transit trip, including vehicle position when tracked.

**Inputs**

| Param | Type | Required | Default | Notes |
|---|---|---|---|---|
| `trip_number` | string | ✓ | – | GO trip number, e.g. `"1004"`. Obtain via `get_next_service`, `get_union_departures`, or `list_lines` + `get_line_schedule`. |
| `date` | `YYYY-MM-DD` | | today (Toronto) | Operational day the trip departed its first stop — trips past midnight keep their origin day even though later stops show the next calendar date. |

**Output**

```json
{
  "trip_number": "1004",
  "destination": "Aldershot GO",
  "status": "modified",
  "position": { "lat": 43.61, "lon": -79.51 },
  "stops": [
    {
      "stop_code": "UN",
      "stop_name": "Union Station",
      "scheduled_departure": "2026-07-19T08:12:00-04:00",
      "expected_departure": "2026-07-19T08:15:00-04:00",
      "track": { "scheduled": "4", "actual": "4" },
      "status": "modified"
    }
  ]
}
```

---

## Service updates

### `get_service_alerts`

Folded GO Transit service/information/marketing alerts — Metrolinx exposes these as three separate feeds; this tool merges them into one.

**Inputs**

| Param | Type | Required | Default | Notes |
|---|---|---|---|---|
| `line` | string | | – | Filter to alerts affecting this line code. Valid values from `list_lines`. |
| `stop` | string | | – | Filter to alerts affecting this stop code. Obtain via `search_stops`. |
| `category` | `"service" \| "information" \| "marketing"` | | service + information | Filter to one category. Marketing (promos) is opt-in only. |
| `lang` | `"en" \| "fr"` | | `"en"` | Response language. |
| `limit` | integer | | 20 | Max 50. |

**Output**

```json
{
  "alerts": [
    {
      "id": "SA-12345",
      "category": "service",
      "status": "updated",
      "posted_at": "2026-07-19T06:00:00-04:00",
      "subject": "Lakeshore West delays",
      "body": "Trains are experiencing delays of up to 15 minutes due to a signal issue.",
      "affected": { "lines": ["LW"], "stops": [{ "stop_code": "UN", "stop_name": "Union Station" }], "trips": ["1004"] }
    }
  ],
  "truncated": false,
  "total_matched": 1
}
```

`status` is one of `"new" | "updated" | "corrected" | "final"`.

### `get_service_exceptions`

Today's schedule exceptions — cancelled trips and stops — for GO Transit.

**Inputs**

| Param | Type | Required | Default | Notes |
|---|---|---|---|---|
| `mode` | `"train" \| "bus" \| "any"` | | `"any"` | Filter by service type. |

**Output**

```json
{
  "exceptions": [
    {
      "trip_number": "1004",
      "trip_name": "1004 - Union to Aldershot",
      "cancelled": true,
      "affected_stops": [
        { "stop_code": "UN", "stop_name": "Union Station", "scheduled_time": "2026-07-19T08:12:00-04:00", "cancelled": true }
      ]
    }
  ],
  "truncated": false,
  "total_matched": 1
}
```

### `get_service_guarantee`

Service guarantee eligibility for a past GO Transit trip.

**Inputs**

| Param | Type | Required | Default | Notes |
|---|---|---|---|---|
| `trip_number` | string | ✓ | – | GO trip number, e.g. `"1004"`. Obtain via `get_line_schedule` — do not guess. |
| `date` | `YYYY-MM-DD` | ✓ | – | Operational day the trip departed its first stop, not necessarily the calendar date of the stop you're checking. Get this from `get_line_schedule`'s `departs_first_stop` or `get_trip_status`, not by reading a later stop's timestamp. |
| `lang` | `"en" \| "fr"` | | `"en"` | Response language. |

**Output**

```json
{
  "eligible": true,
  "stops": [{ "stop_code": "OA", "scope": "delay", "reason": "Trip arrived more than 15 minutes late." }]
}
```

### `get_union_departures`

Live Union Station departure board for trains and buses.

**Inputs**

| Param | Type | Required | Default | Notes |
|---|---|---|---|---|
| `mode` | `"train" \| "bus" \| "any"` | | `"any"` | Filter by service type. |

**Output**

```json
{
  "departures": [
    {
      "trip_number": "1004",
      "mode": "train",
      "service": "Lakeshore West",
      "time": "2026-07-19T08:12:00-04:00",
      "platform": "4",
      "stops_served": [{ "stop_code": "OA", "stop_name": "Oakville GO" }]
    }
  ],
  "truncated": false,
  "total_matched": 1
}
```

---

## Fares & fleet

### `get_fares`

Fare rows (rider type, payment method, amount) between two GO Transit stops, flattened from Metrolinx's category/ticket nesting.

**Inputs**

| Param | Type | Required | Default | Notes |
|---|---|---|---|---|
| `from_stop_code` | string | ✓ | – | GO stop code to travel from, e.g. `"UN"`. Obtain via `search_stops`. |
| `to_stop_code` | string | ✓ | – | GO stop code to travel to, e.g. `"OA"`. Obtain via `search_stops`. |
| `date` | `YYYY-MM-DD` | | standard (undated) fare table | Operational day. |

**Output**

```json
{
  "fares": [
    { "rider": "adult", "method": "presto", "amount": 8.9, "category": "Zone 1-2" },
    { "rider": "adult", "method": "paper", "amount": 10.75, "category": "Zone 1-2" }
  ],
  "truncated": false,
  "total_matched": 2
}
```

### `get_fleet_consist`

The physical car makeup of a GO train, looked up by trip number (via the fleet feed's remaining-trip data) or engine number. Provide exactly one of `trip_number`/`engine_number` — both or neither is an `invalid_input` error.

**Inputs**

| Param | Type | Required | Default | Notes |
|---|---|---|---|---|
| `trip_number` | string | one of the two | – | Obtain via `get_trip_status` or `get_vehicle_positions`. |
| `engine_number` | string | one of the two | – | Locomotive engine number, looked up directly. |

**Output**

```json
{
  "engine_number": "615",
  "coach_count": 12,
  "cars": [{ "type": "Bi-Level Coach", "order": 1, "number": "2201" }],
  "remaining_trips": [{ "trip_number": "1006", "line": "Lakeshore West", "start_time": "2026-07-19T09:00:00-04:00", "end_time": "2026-07-19T09:53:00-04:00" }]
}
```

No consist found returns a `not_found` in-result error suggesting `get_trip_status` or `get_vehicle_positions` to verify the number.

---

## Real-time (GTFS-RT)

### `get_vehicle_positions`

Live positions, delay, and occupancy for GO vehicles of one mode (train, bus, or UPX).

**Inputs**

| Param | Type | Required | Default | Notes |
|---|---|---|---|---|
| `mode` | `"train" \| "bus" \| "upx"` | ✓ | – | Vehicle mode to query. |
| `line_code` | string | | – | Filter to one line, e.g. `"LW"`. Valid values from `list_lines`. |
| `trip_number` | string | | – | Filter to one trip number, e.g. `"1026"`. |
| `limit` | integer | | 20 | Max 50. |

**Output**

```json
{
  "vehicles": [
    {
      "trip_number": "1026",
      "line_code": "LW",
      "mode": "train",
      "position": { "lat": 43.61, "lon": -79.51 },
      "delay_minutes": 2,
      "next_stop": { "stop_code": "OA", "stop_name": "Oakville GO" },
      "in_motion": true,
      "updated_at": "2026-07-19T08:20:00-04:00"
    }
  ],
  "truncated": false,
  "total_matched": 1
}
```

`occupancy_percent` is only populated when the upstream GTFS-RT feed reports it, which in practice requires elevated Metrolinx API access most keys don't have — expect it absent.

### `get_trip_updates`

What's off-plan right now. **Unfiltered call = disruptions-only**: with no filters, only trips with a material delay (≥3 minutes) or cancelled/skipped stops are returned. With any filter set, everything matching is returned, including on-time confirmations.

**Inputs**

| Param | Type | Required | Default | Notes |
|---|---|---|---|---|
| `line_code` | string | | – | Filter to one line, e.g. `"LW"`. Valid values from `list_lines`. |
| `trip_number` | string | | – | Filter to one trip number, e.g. `"1026"`. |
| `stop_code` | string | | – | Filter to trips with an update at this stop. Obtain via `search_stops`. |
| `limit` | integer | | 20 | Max 50. |

**Output**

```json
{
  "updates": [
    {
      "trip_number": "1026",
      "line_code": "LW",
      "direction": "W",
      "status": "delayed",
      "delay_minutes": 6,
      "stop_updates": [
        { "stop_code": "OA", "expected_arrival": "2026-07-19T08:58:00-04:00", "scheduled_arrival": "2026-07-19T08:52:00-04:00", "status": "delayed" }
      ],
      "updated_at": "2026-07-19T08:20:00-04:00"
    }
  ],
  "truncated": false,
  "total_matched": 1
}
```
