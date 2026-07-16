---
id: "004"
title: "Grilling: MCP Primitive Mapping"
type: grilling
status: open
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
