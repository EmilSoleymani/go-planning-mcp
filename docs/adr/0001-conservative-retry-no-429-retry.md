---
status: accepted
---

# Conservative retry policy: never retry 429

The Metrolinx API's rate limit is undocumented — only the existence of a per-key quota is known (HTTP 429 defined in the API Data Catalogue), and Metrolinx reserves the right to disable keys for "excessive usage". We decided the Metrolinx client retries only network errors/timeouts and HTTP 5xx (including 5xx codes tunneled through HTTP 200 in the body's `Metadata.ErrorCode` — see the [API research report](../../.wayfinder/research/handoff-001-metrolinx-api-research.md), §1 and §4), with 2 retries (3 attempts total), 500 ms initial backoff, ×2 multiplier, 5 s cap, full jitter. A 429 — whether transport-level or body-tunneled — is **never retried**: it surfaces immediately to the LLM so the user knows the key is throttled. Retrying against an unknown quota risks burning more of it and, in the worst case, getting the key disabled; transparency beats silent waiting.

## Considered Options

The rejected alternative, kept here for a potential future flip: **3 retries with 429 retryable** at a longer 2 s initial backoff (other parameters identical). Flip to it if real-world usage (e.g. weekly smoke tests or production telemetry) shows Metrolinx 429s are transient and short-windowed rather than a sign of a daily/monthly quota being exhausted.
