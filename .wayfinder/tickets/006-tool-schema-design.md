---
id: "006"
title: "Grilling: MCP Tool Schema Design"
type: grilling
status: resolved
assignee: emil
blocked_by: ["004"]
blocks: ["007"]
---

## Question

For each MCP Tool and Resource identified in ticket 004, define the exact schema:

- Tool name (snake_case convention)
- Description (what the LLM reads to decide when to call it)
- Input parameters: name, type, required/optional, description, constraints/enums
- Output shape: what the tool returns to the LLM
- Error response format: how failures surface to the LLM

Also decide:
- Naming convention for tools (e.g. `get_trip_plan`, `list_stops`, `get_service_alerts`)
- How to handle pagination — does the MCP tool paginate internally or expose pagination to the LLM?
- How timestamps/dates are represented (ISO 8601? Unix epoch?)
- How stop IDs and route IDs are typed and documented for the LLM

## Answer

Grilled 2026-07-16. Full schema spec: [docs/spec/tool-schemas.md](../../docs/spec/tool-schemas.md). Thirteen decisions, all confirmed one-by-one:

**Cross-cutting conventions:**

1. **Fully normalized DTOs, never passthrough** — snake_case fields, uniform vocabulary, single-letter upstream enums expanded, `Metadata` envelope stripped. English default; French opt-in via per-call `lang: "en" | "fr"` on text-bearing tools only.
2. **`outputSchema` + `structuredContent` on all 17 tools**, Zod-defined so input/output schemas share one source.
3. **ISO 8601 both directions** — inputs `YYYY-MM-DD` / `HH:MM`, outputs with explicit DST-aware offset; server owns the Toronto clock for defaults; service-day times (`25:30`) normalized; conversion to Metrolinx wire formats is the server's job.
4. **IDs are opaque strings** — unified `stop_code` concept (station codes + bus PublicStopIds in one field), every ID description carries example + provenance ("obtain via search_stops — do not guess").
5. **In-result errors** (`isError: true`) with one normalized `{ error: { code, message, retryable } }` shape; closed enum (`rate_limited`, `upstream_auth_failed`, `upstream_unavailable`, `not_found`, `invalid_input`, `upstream_error`); messages are instructions for the LLM, not diagnostics; disambiguation is a *success*, never an error.
6. **No pagination** — `limit` + `truncated`/`total_matched` + narrow-the-filter guidance; cursors over live snapshots would be fake.

**Per-tool highlights:**

7. **`plan_trip` ships `arrive_by`** (`time_mode` param), emulated via back-shifted `Schedule/Journey` window — matches the official frontend's feature set.
8. **`plan_trip` is journey-only** — echoes fuzzy-resolved `from`/`to`, returns itineraries with legs, or `status: "ambiguous"` + candidates; fares/alerts stay in their own tools, composed by the `plan_a_trip` prompt.
9. Stop tools approved incl. **derived `delay_minutes`** on `get_next_service` (server does the timestamp math).
10. **Alerts default = service + information; marketing opt-in only.**
11. **`get_line_schedule` is two-mode anti-dump**: trip summaries without `stop_code`, per-stop times with it; full trip detail lives in `get_trip_status`. `get_fares` flattens to scannable rows.
12. **Unfiltered `get_trip_updates` = disruptions-only** (delay ≥ 3 min or cancellation) — the bare call means "what's off-plan right now?".
13. **Resources serve exactly the mirror tools' DTOs** (shared serializer, no drift) + static `gotransit://lines` alias for today; prompt args pinned (freeform `when` on `plan_a_trip`, time-of-day-inferred `direction` on `check_my_commute`).

Open verifications flagged for implementation (not new tickets): E/C/A and S/M enum meanings, live timestamp formats, arrive-by window tuning.
