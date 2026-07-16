---
id: "006"
title: "Grilling: MCP Tool Schema Design"
type: grilling
status: open
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
