---
id: "004"
title: "Grilling: MCP Primitive Mapping"
type: grilling
status: resolved
blocked_by: ["001"]
blocks: ["006", "007"]
---

## Question

Using the Metrolinx API inventory from ticket 001, decide which endpoints map to which MCP primitive:

- **Tools** — live queries the LLM invokes to fetch real-time or user-specific data (trip planning, live departures, service alerts)
- **Resources** — slow-changing or static data the LLM can read without a round-trip (stop lists, route definitions, schedule calendars)
- **Prompts** — reusable templates composing multiple tools into common flows (plan my commute, check if my train is on time, find stations near me)

Decisions needed per endpoint group:
1. Which primitive type fits?
2. What is the MCP tool/resource/prompt name (naming convention)?
3. Are any endpoints too low-level to expose directly — should they be composed into higher-level tools?
4. Which Prompts are high-value enough to ship in v1?

## Answer

Grilled 2026-07-16. Six decisions:

1. **GTFS-RT feeds: filtered Tools, never raw.** The three GTFS-RT families return full-dataset snapshots (hundreds of KB) — context-hostile for an LLM. They're exposed through tools with server-side filtering (by `route_id`/`trip_id`, result count capped) rather than raw dumps. Full coverage preserved, context respected.

2. **Trip planning: composed + raw.** A composed `plan_trip(from, to, date?, time?)` accepts human station names, resolves them server-side via fuzzy match against `Stop/All`, calls `Schedule/Journey`, and returns the plan. Ambiguous names return a candidate list for the LLM to disambiguate with the user. Raw primitives (`plan_journey` taking stop codes, `search_stops`) remain available for fine control.

3. **Alerts: one filtered tool.** `get_service_alerts(line?, stop?, category?)` folds all three alert endpoints (service/information/marketing) behind a `category` filter.

4. **Static data ships as Resources AND mirror Tools.** Resources (`gotransit://stops`, `gotransit://stops/{code}`, `gotransit://lines/{date}`) for clients that support them; mirror tools (`search_stops`, `get_stop_details`, `get_line_schedule`) because many MCP clients ignore resources. Both paths share the same internal client.

5. **17-tool roster approved** (snake_case, verb-first): `plan_trip`, `plan_journey`, `search_stops`, `get_stop_details`, `get_next_service`, `get_stop_destinations`, `get_union_departures`, `get_service_alerts`, `get_service_exceptions`, `get_service_guarantee`, `get_line_schedule`, `list_lines`, `get_trip_status`, `get_fares`, `get_vehicle_positions` (mode: bus/train/upx, merges ServiceataGlance + GTFS-RT VehiclePosition), `get_trip_updates`, `get_fleet_consist`.

6. **Three v1 Prompts:** `plan_a_trip` (name resolution → journey → natural-language summary with fares/alerts), `check_my_commute` (exceptions + alerts + next service for a stop pair), `service_status` (network-wide digest).
