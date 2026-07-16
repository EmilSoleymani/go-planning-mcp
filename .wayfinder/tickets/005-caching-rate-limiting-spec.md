---
id: "005"
title: "Grilling: Caching & Rate Limiting Spec"
type: grilling
status: open
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
