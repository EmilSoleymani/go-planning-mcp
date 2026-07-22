# GO Planning MCP Server

An MCP server wrapping the Metrolinx (GO Transit) Open Data REST API — raw
mirrors plus a composed trip planner — for LLM agents and an eventual
frontend.

## Language

### Trip composition

**Composition hub**:
A stop `plan_trip` is allowed to stitch a transfer through. Membership is a
curated table, not derived from data.
_Avoid_: transfer point, interchange (too generic — any Train & Bus Station
permits a transfer; only hubs are *tried* during composition)

**Walking pair**:
Two distinct stop codes that are one physical place for transfer purposes
(e.g. `UN` ↔ `02300` Union Station Bus Terminal, `LA` ↔ `00350` Richmond
Hill Centre). Composition may end leg 1 at one code and start leg 2 at the
other.
_Avoid_: co-located stops, same station

**Endpoint terminal**:
A bus terminal that is a route terminus with no interchange value (Brantford,
Peterborough, McMaster, University of Waterloo). Never a composition hub —
trips there are served by the direct query.

**Upstream-attested**:
Timetable data returned verbatim by a real `Schedule/Journey` call. Every leg
in a composed itinerary is upstream-attested; only the pairing at a hub is
ours.
_Avoid_: real, official

**Composed itinerary**:
An itinerary `plan_trip` built by pairing two upstream-attested legs at a
single composition hub (one-transfer ceiling, ADR 0003).
_Avoid_: stitched trip, synthetic itinerary

**Transfer buffer**:
The minimum minutes between leg 1's arrival and leg 2's departure at a hub
for the pairing to count as feasible. Curated per hub.

**Hub ladder**:
The detour-ranked queue of candidate hubs a plan probes sequentially,
early-exiting at the first feasible pairing. Union is row one, not a
special case.

**Detour ratio**:
`(dist(from, hub) + dist(hub, to)) / dist(from, to)` — hubs above the
cutoff are excluded from the ladder before any probing.
