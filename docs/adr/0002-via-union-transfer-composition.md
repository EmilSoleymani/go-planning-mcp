---
status: accepted
---

# plan_trip composes cross-line transfers via Union; upstream planner is direct-only

Confirmed live (2026-07-18, during issue #12 verification): both documented
`Schedule/Journey` variants — `ToStopCode` as a route segment and as a query
parameter — return `ErrorCode: "200"` with `SchJourneys: []` for a cross-line
pair (Unionville GO `UI` → Exhibition GO `EX`) that the official gotransit.com
planner routes via a Union transfer. The endpoint's documented `Transfers[]` /
`TransferLinks[]` fields have never been observed populated. The raw endpoint
is a direct/single-corridor planner, which falsifies the assumption behind the
tool-schemas spec's original "journey-only by design" framing of `plan_trip` —
without composition, the server's headline capability cannot answer most
cross-line commutes at all.

We decided `plan_trip` composes the transfer itself: when the direct journey
query returns empty and neither endpoint is Union, it makes two further
journey calls (`from → UN`, `UN → to`) and pairs each inbound arrival with the
earliest onward departure at least **10 minutes** later (a starting heuristic
in the same spirit as the `arrive_by` back-shift window; tune against real
data). Union (`UN`) is the sole composition hub — GO rail is hub-and-spoke
through Union, so this covers the vast majority of cross-line trips at a
bounded cost: worst case 3 upstream calls per invocation (6 under `arrive_by`'s
widening retry). Every leg in a composed itinerary is upstream-attested
timetable data from a real journey call; only the pairing is ours, and it is
visible to the caller as ordinary multi-leg itineraries (`transfers` ≥ 1, legs
meeting at `UN`) — no DTO change. `plan_journey` remains a pure single-call
mirror of `Schedule/Journey`, preserving raw API fidelity in the roster per
the composed-vs-raw split from the primitive-mapping decisions (ticket 004).

## Considered Options

- **No composition; LLM orchestrates segments via output-schema guidance** —
  rejected: deterministic consumers (the planned frontend/backend) would each
  reimplement stitching, and an LLM juggling timetable pairing is slower and
  error-prone compared to twenty lines of code.
- **A separate composed tool (e.g. `plan_trip_with_transfers`)** — rejected:
  the caller would need to know whether a transfer is required *before*
  choosing the tool, which is precisely what it cannot know; empty-then-retry
  across two tools doubles latency and bloats the roster.
- **General multi-hub composition (bus terminals: Union Station Bus Terminal,
  Bramalea, Square One, …)** — deferred, not rejected: bus-to-bus pairs that
  never touch Union remain unserved by this ADR. Hub selection, per-hub
  transfer buffers, and the upstream call budget need a grilling session of
  their own; tracked in issue #35.
