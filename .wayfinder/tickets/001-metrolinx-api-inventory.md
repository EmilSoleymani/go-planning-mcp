---
id: "001"
title: "Research: Metrolinx API Inventory"
type: research
status: resolved
blocked_by: []
blocks: ["004", "005"]
---

## Question

What does the Metrolinx Open Data API actually expose? Fetch and document:

- Every available endpoint (URL, method, parameters, response shape)
- Authentication model — how are API keys obtained? Is there a developer registration portal? Is there a cost?
- Rate limits — requests per second/minute/day? Are they documented or must they be inferred?
- Response formats — JSON? XML? Both?
- Any sandbox/test environment available?
- Any terms of service restrictions relevant to an open source project wrapping the API
- Webhook or push capabilities (if any)
- Known quirks, deprecated endpoints, or version differences

Base URL: https://api.openmetrolinx.com/OpenDataAPI/Help/Index/en

Produce a structured report grouping endpoints by domain (trip planning, stops, schedules, alerts, real-time, etc.) and flagging which are candidates for MCP Tools vs Resources vs Prompts.

## Research

Findings captured on branch `research/metrolinx-api-inventory`: [.wayfinder/research/handoff-001-metrolinx-api-research.md](../research/handoff-001-metrolinx-api-research.md)

Open gaps not resolvable from primary sources — needs empirical testing once an Access Key is issued, or direct confirmation from Metrolinx: the exact API-key parameter/header name, the numeric rate limit (only the existence of a 429 quota is documented), whether the Open Government Licence covers live API responses vs. just static downloads, and the full text of the GTFS "Access and Use Agreement."

**Update (2026-07-16), empirical testing with a live key:**
- Resolved — auth is `?key=<value>` as a query parameter. Auth failures (missing/invalid key) return transport-level HTTP 200 with `Metadata.ErrorCode: "401"` in the body, not a real HTTP 401 — any wrapper must check the body, not the status code.
- Resolved — the documented `.xml`/`.json` URL-suffix format selector does not work live (404); the `Accept` header does (`Accept: text/xml` confirmed working).
- Still open, deliberately not tested — numeric rate limit. Decided not to probe this empirically (risk of the key being flagged/disabled for "excessive usage" per the Data Catalogue). Revisit as separate research only if rate limiting becomes an operational issue.
- Still open — OGL licence scope over live responses, and the GTFS Access and Use Agreement text. Unchanged from the original research pass; would need direct confirmation from Metrolinx (`OpenData.Program@metrolinx.com`).

## Answer

Full report: [.wayfinder/research/handoff-001-metrolinx-api-research.md](../research/handoff-001-metrolinx-api-research.md)

**What the API exposes:** 34 GET-only endpoints across 8 domains — Stop (next service, details, destinations, all stops), Service Update (alerts ×3, Union departures, service guarantee, exceptions), Service at Glance (live bus/train/UPX positions+delays), Schedule (journey planner, line, trip), GTFS Feeds (Alerts/TripUpdates/VehiclePosition in JSON/XML/protobuf), UP GTFS-RT (same 3, UPX-scoped), Fleet (consist makeup + occupancy GTFS-RT), and Fares. Everything is pull/poll — no webhooks or push of any kind.

**Auth:** `?key=<value>` query parameter. Auth failures return transport-level HTTP 200 with `Metadata.ErrorCode: "401"` in the body — the wrapper **must** check `Metadata.ErrorCode`, not the HTTP status code.

**Formats:** JSON (default) and XML via `Accept` header. The documented `.xml`/`.json` URL-suffix selector is dead on the live API (404). Protobuf confirmed working on `api/V1/Gtfs/Feed/*`; unverified on the UP and Fleet GTFS-RT families (Help pages don't show protobuf samples for those).

**Cost/access:** Free; manual registration with up to 10 business-day approval. No sandbox.

**MCP primitive split (see §7 of the report for full breakdown):**
- **Tools:** `Schedule/Journey` (trip planner), `Stop/NextService`, `Stop/Destinations`, `ServiceUpdate/UnionDepartures`, exceptions/guarantee lookups, `ServiceataGlance/*`, `Fares`, `Schedule/Trip`, `Fleet/Consist`, GTFS-RT feeds.
- **Resources:** `Stop/All`, `Stop/Details`, `Schedule/Line/*` (published daily schedule).
- **Prompts:** One plausible prompt — a "plan my GO trip" scaffold that chains name→stop-code resolution + `Schedule/Journey` + natural-language summary.

**Open items (do not block 004/005, but downstream sessions should know):**
1. **Numeric rate limit** — undocumented; a per-key quota exists (HTTP 200 + 429 code in body), size unknown. Decided not to probe empirically. Design conservatively with client-side caching and backoff; revisit as a separate research ticket only if it becomes an operational problem.
2. **OGL licence scope** — the Open Government Licence (commercial use + redistribution OK, attribution required) is linked from the Metrolinx open-data landing page, not from `api.openmetrolinx.com` itself. Whether it explicitly covers live API responses (vs. just static GTFS downloads) is unconfirmed. Recommend emailing `OpenData.Program@metrolinx.com` before publishing a hosted multi-tenant wrapper.
3. **GTFS Access and Use Agreement** — full text was behind a click-through gate, not fetchable. Same email above.
