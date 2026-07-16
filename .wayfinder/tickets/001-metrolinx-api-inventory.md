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
