---
id: "003"
title: "Research: Vercel Free Tier Constraints"
type: research
status: resolved
blocked_by: []
blocks: ["009"]
---

## Question

Document the Vercel Hobby (free) tier constraints that affect this MCP server:

- Serverless function execution timeout (default and max)
- Maximum request/response body size
- Invocation limits per month
- Cold start behaviour — typical latency on Node.js runtimes
- Whether Streamable HTTP (chunked transfer / long-polling) works within function timeout limits
- Edge Runtime vs Node.js Runtime — which is available on free tier and which suits an MCP server?
- Preview deployment behaviour for PRs — does it work on free tier?
- Any bandwidth limits relevant to transit API response sizes

Conclude with: are there any Vercel free tier constraints that would force a design change, or is the plan viable as stated?

## Answer

Full report: [.wayfinder/research/003-vercel-constraints-report.md](../research/003-vercel-constraints-report.md)

**Verdict: viable as stated — no design change forced.** All figures from Vercel primary sources (docs/blog/changelog/npm registry), checked 2026-07-16.

- **Timeout:** 300 s default *and* max on Hobby with Fluid compute (enabled by default for new projects since 2025-04-23). The clock includes streamed response time. Legacy non-fluid Hobby limits (10 s/60 s) do not apply to new projects.
- **Body size:** 4.5 MB request/response payload cap (`413` beyond it), but **streamed responses are exempt** from the response-side limit per Vercel's own KB. Metrolinx worst-case payloads (hundreds of KB) are ~10× under the cap even unstreamed.
- **Monthly quotas (Hobby):** 1 M invocations, **4 active-CPU-hrs** (the likely binding constraint — I/O wait is free), 360 GB-hrs provisioned memory, 100 GB Fast Data Transfer, up to 10 GB Fast Origin Transfer. Exceeding a limit pauses the feature until the 30-day window rolls over — no surprise bills. Hobby is licensed for **non-commercial personal use only**.
- **Streamable HTTP:** works — each JSON-RPC POST is one invocation with its own 300 s budget; this is exactly the pattern Vercel documents in its official MCP guide. Redis is needed only for the legacy SSE transport, not Streamable HTTP. The optional long-lived GET notification stream is capped at 300 s/connection — irrelevant here since Metrolinx is poll-only (ticket 001); design stateless per-request.
- **Runtime:** use **Node.js** (the default). Vercel now explicitly recommends migrating *off* the Edge runtime; the MCP SDK needs Node APIs, and Vercel's `mcp-handler` requires Node 18+. Note for ticket 007: `mcp-handler` (v1.1.0, the renamed `@vercel/mcp-adapter`) peer-depends on `next` and exact-pins the MCP SDK version — using the SDK's own `StreamableHTTPServerTransport` in a plain Vercel function is an equally supported, dependency-lighter alternative.
- **PR previews:** every branch push gets a preview URL on Hobby, but **not from private repos owned by a GitHub organization** (public personal repo per ticket 002 → moot). Preview protection (Vercel Authentication) is available on Hobby; whether Protection Bypass for Automation is Hobby-eligible is undocumented — verify in ticket 009.
- **Cold starts:** no official ms figure exists (docs are silent). Hobby gets bytecode caching (production only, Node 20+) and pre-warming; "scale to one" is documented for Pro/Enterprise only, so assume idle scale-to-zero on Hobby. Mitigation: keep the deployed bundle's dependencies minimal.

**Open items (non-blocking):** Protection Bypass availability on Hobby (ticket 009 to verify empirically); no official cold-start latency number; scale-to-one plan scoping ambiguity; whether function→Metrolinx egress is separately metered (docs silent, volume tiny).
