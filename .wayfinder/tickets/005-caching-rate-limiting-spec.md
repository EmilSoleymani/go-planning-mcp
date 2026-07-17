---
id: "005"
title: "Grilling: Caching & Rate Limiting Spec"
type: grilling
status: resolved
blocked_by: ["001"]
blocks: ["007"]
---

## Question

Using the Metrolinx API rate limit findings from ticket 001, spec the retry and caching strategy:

**Retry (already decided: exponential backoff on transient failures)**
- How many retries before giving up?
- What backoff parameters (initial delay, multiplier, max delay, jitter)?
- Which HTTP status codes trigger a retry vs immediate failure?

**Caching (to decide)**
- Should any Resource endpoints (static/slow-changing data) be cached in-process?
- If yes: what TTLs per data type (stops: longer, alerts: shorter)?
- Cache invalidation strategy — time-based only, or triggered by specific API responses?
- Should caching be optional (configurable via env var) so self-hosters can disable it?

## Answer

Grilled 2026-07-16.

**Retry policy** (recorded as [ADR 0001](../../docs/adr/0001-conservative-retry-no-429-retry.md)):
- Retry only network errors/timeouts and HTTP 5xx — including 5xx codes tunneled through HTTP 200 in the body's `Metadata.ErrorCode`
- **429 is never retried** — surfaced immediately to the LLM so the user knows the key is throttled (rate limit is undocumented; retrying an unknown quota risks burning it / key disablement)
- 2 retries (3 attempts total), 500 ms initial, ×2 multiplier, 5 s cap, full jitter
- Never retry 401/404/other 4xx
- Rejected-but-documented alternative (3 retries, 429 retryable at 2 s initial) lives in the ADR with its flip trigger: revisit if smoke tests/telemetry show 429s are transient

**Caching:** in-process best-effort cache (simple TTL map, zero dependencies):
- `Stop/All`, `Stop/Details`: 24 h
- `Schedule/Line/*`, `Fares`: 6 h (keyed by date)
- Alerts, exceptions, next-service, vehicle positions, trip updates, journey plans: never cached (real-time)
- Invalidation is time-based only
- `CACHE_ENABLED` env var (default true), optional `CACHE_TTL_*` overrides
- Fully effective on Docker (long-lived process); best-effort on Vercel (warm invocations only) — acceptable, degrades to no-op
