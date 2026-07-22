---
status: accepted
---

# Multi-hub transfer composition is capped at one transfer

Extending ADR 0002's via-Union composition to bus hubs (issue #35) raised the
question of how deep `plan_trip`'s stitching should go — complete network
coverage arguably needs two transfers (bus → rail → bus). We decided a **hard
one-transfer ceiling**: `plan_trip` composes at most two upstream-attested
legs joined at a single hub. One transfer over a good hub set covers the
overwhelming share of real GO journeys (bus feeders exist to meet rail at
terminals); two transfers turns hub choice into hub-*pair* pathfinding,
inflating the upstream call count from `1 + 2N` toward `1 + 3N²` under ADR
0001's rate-limit caution — a routing engine wearing a wrapper's clothes. If
no single-hub composition works, `plan_trip` returns empty rather than
speculative chains. Should two-transfer demand materialize, the answer is
GTFS-based routing (e.g. OTP) as a separate effort, not deeper stitching of
`Schedule/Journey` calls.

## Hub set: a curated table, not derived

Hub membership is a **hardcoded curated table** (in the spirit of the
`LINE_NAMES` map), not derived from `Stop/All`'s `LocationType` or probed via
`Stop/Destinations`. The narrowing knowledge — which corridors a hub serves,
its transfer buffer, walking pairs — exists in no API endpoint, so a curated
table must exist regardless; deriving candidacy on top of it only hides the
curation. GO's terminal network changes on a timescale of years. Two
sub-tables (classified 2026-07-21 from network knowledge + web verification):

- **Walking pairs** (distinct codes, one physical place): `UN`↔`02300`
  (Union Station Bus Terminal), `BE`↔`00225`/`08032` (Bramalea),
  `KP`↔`02778` (Kipling), `LA`↔`00350` (Richmond Hill Centre, 31 m
  pedestrian bridge), `NI`↔`02408` (Niagara Falls, across Bridge St —
  lowest priority). Explicitly NOT a pair: `SC` Scarborough GO vs `02816`
  Scarborough Centre Bus Terminal — several km apart despite the name.
- **Hub roster**: the standalone terminals Union Station Bus Terminal,
  Square One, Hwy 407, Finch, Scarborough Centre, Yorkdale, York Mills,
  Richmond Hill Centre, Bramalea, Kipling; the strong Train & Bus stations
  (Bramalea, Oakville, Burlington, Aldershot, Hamilton GO Centre, Milton,
  Guelph Central, Kitchener, Whitby, Durham College Oshawa, Aurora,
  Newmarket, Unionville, Langstaff); and Pearson Airport Terminal 1 (`PA`,
  UP Express + airport bus routes).

Excluded deliberately: **endpoint terminals** (Brantford, Peterborough,
McMaster, University of Waterloo — route termini with no interchange value)
and **Kennedy GO** (its interchange value is TTC, which this planner does not
cover). Duplicate bus-terminal codes (Square One ×2, Hwy 407 ×2, …) are
directional/platform split entries; the canonical journey-planning code per
terminal is resolved empirically during fixture capture.

## Per-query hub selection: geometric detour ranking

For a given from/to pair, candidate hubs are ranked by **geometric detour**:
`dist(from, hub) + dist(hub, to)`, ascending, using hub coordinates curated
into the hub table (static facts, captured once) and endpoint coordinates
from `Stop/Details` (two calls, cacheable at the 24h stops tier). Hubs with
an absurd detour ratio — `dist(from,hub) + dist(hub,to) > 1.6 ×
dist(from,to)` (tunable) — are excluded outright, so a Barrie→Newmarket
query never probes Square One. Geometry is pair-aware for every stop type
(including the ~772 curbside bus stops, which have no static route/region
data), and a geometrically-plausible but topologically-infeasible hub costs
only a wasted probe: the journey calls themselves filter it out.

Rejected for selection: **`Stop/Destinations` reachability probing** (it is
a live time window — probing at night for a next-morning trip can return
nothing; entries repeat per departure; free-text `DestinationStop` matching
is fragile), **a curated region matrix** (bus-stop endpoints have no static
region, so the motivating bus-to-bus case degrades to blind ordering), and
**blind global priority order** (wastes probes on pair-irrelevant hubs).
Precomputing hub reachability at the 24h tier (floated in issue #35) is
dropped along with probing — geometry needs no reachability data.

## Call budget: K=3, sequential, early-exit; arrive_by wide retry K=1

The hub ladder probes at most **K=3** hubs per plan, **sequentially** in
detour-rank order, **early-exiting** at the first hub that yields ≥1
feasible pairing (each hub costs ≤2 journey calls; the onward call is
skipped when the inbound leg is empty). Worst case is 7 journey calls (1
direct + 3×2), up modestly from ADR 0002's 3 — and only when everything
returns empty, which is cheap upstream. `arrive_by`'s widening retry runs
the ladder with **K=1** (top-ranked hub only), capping arrive_by at 10
journey calls instead of the 14 a flat K=3 would allow; the marginal value
of hubs 2–3 on a second, wider pass does not justify doubling the budget
under ADR 0001's rate-limit caution. Parallel probing was rejected: it
spends the full budget every time to shave latency off what is already the
fallback path, and the geometric ranking makes the first sequential probe
the likely winner. "Probe all K and merge for better itineraries" was
rejected on the same grounds — speculative quality for certain calls.

**Union is not special-cased**: it becomes row one of the unified hub table
and competes on detour ranking like every other hub (with a priority boost
as tiebreaker), replacing ADR 0002's dedicated via-Union branch with one
code path.

## Transfer buffers: per-hub column, default 10, one launch override

The hub table carries a **per-hub transfer-buffer column** (minutes between
leg 1 arrival and leg 2 departure for a pairing to be feasible), defaulting
to ADR 0002's 10. Exactly one override ships at launch: **15 minutes for
the `UN`↔`02300` walking pair** — the trainshed→concourse→USBT walk is
realistically 5–8 minutes before any lateness slack, it is the
highest-traffic hub, and a missed connection there is the worst outcome
this feature can produce. All other values stay at 10 pending evidence:
inventing per-hub numbers without data is false precision. The column
exists so the planned fixture-capture/tuning pass has somewhere to write
results. Per-mode buffers (bus legs being less punctual than rail) were
considered and deferred — a second dimension of guesswork; revisit only if
fixture data shows bus-arrival variance breaking pairings.

## Result honesty: an optional `composed: true` flag

Composed itineraries carry an additive optional **`composed: true`** field
in the `plan_trip` DTO (absent on direct upstream results), revising ADR
0002's no-DTO-change stance now that composition extends beyond Union. The
deciding argument is real-world: a composed transfer is **not a
GO-published connection** — GO's service guarantee and connection
protection apply to itineraries they publish, so a caller (LLM or the
future frontend) must be able to tell the user a transfer is
planner-suggested, not carrier-guaranteed. A rich provenance object (hub
code, buffer, per-leg attestation) was rejected: the hub is visible in the
legs, the buffer is an internal knob, and per-leg attestation is redundant
because every leg is upstream-attested by construction — the ADR 0002
invariant this ADR preserves. `plan_journey` remains an uncomposed raw
mirror.
