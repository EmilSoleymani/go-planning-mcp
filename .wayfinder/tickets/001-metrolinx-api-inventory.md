---
id: "001"
title: "Research: Metrolinx API Inventory"
type: research
status: open
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
