---
label: wayfinder:map
---

# GO Transit MCP Server — Wayfinder Map

## Destination

A complete technical spec and Metrolinx API research report for the GO Transit MCP server, ready to hand off to a separate implementation agent. The spec covers architecture, tool schemas, CI/CD, Docker packaging, and Vercel deployment. No code is written by this map — only decisions.

## Notes

- **Domain:** GO Transit (Metrolinx) trip planning MCP server
- **Language:** TypeScript / Node.js, `@modelcontextprotocol/sdk`
- **Transports:** stdio (Claude Desktop) + Streamable HTTP (Docker / Vercel)
- **Hosting:** Vercel free tier (owner) + Docker container (self-hosters, open source)
- **License:** MIT
- **Skills to consult:** `/grilling`, `/domain-modeling`, `/research`
- Every grilling ticket should be worked one question at a time, waiting for user input

## Decisions so far

- [Research: Metrolinx API Inventory](tickets/001-metrolinx-api-inventory.md) — 34 GET endpoints across 8 domains (Stop, ServiceUpdate, ServiceataGlance, Schedule, GTFS Feeds, UP GTFS-RT, Fleet, Fares). Auth via `?key=` query param; auth failures return HTTP 200 with `Metadata.ErrorCode: "401"` in body — wrapper must check body not status. Format selection via `Accept` header (documented URL suffix is dead). No sandbox, no push/webhooks, everything is poll. Primitive split: Tools for real-time/query endpoints; Resources for `Stop/All`, `Stop/Details`, daily Schedule/Line; one useful Prompt template (trip-plan scaffold). Open items (non-blocking): numeric rate limit undocumented, OGL licence scope over live responses unconfirmed, GTFS Access and Use Agreement text not retrieved.
- [Research: Vercel Free Tier Constraints](tickets/003-vercel-constraints.md) — Hobby tier is viable, no design change forced. 300s function timeout (default=max, Fluid compute), 4.5 MB body cap (streamed responses exempt), 1M invocations + 4 active-CPU-hrs/month (CPU-hrs is the binding constraint; overage pauses the feature, no bills). Use Node.js runtime (Vercel now recommends against Edge); Streamable HTTP per-POST invocation is Vercel's own documented MCP pattern (`mcp-handler`, Redis only for legacy SSE). PR previews work on Hobby for personal repos (not GitHub-org private repos). Hobby is non-commercial use only. Open items: Protection Bypass on Hobby unverified, no official cold-start ms figure, assume idle scale-to-zero.

## Not yet specified

- Exact retry parameters (retry count, backoff curve, jitter) — rate limit is undocumented; design conservatively, revisit only if it becomes an operational problem
- Whether any Resource endpoints warrant in-process caching and at what TTLs — now informed by ticket 001; to be pinned in ticket 005
- Exact tool/resource/prompt names and schemas — depends on primitive mapping (ticket 004)
- Whether ghcr.io image publishing is worth the complexity for v1 or deferred

## Out of scope

- The frontend app (explicitly deferred to a separate future effort)
- The backend that will eventually consume this MCP server (deferred)
- Per-user authentication on the MCP server itself (self-hosters bring their own `METROLINX_API_KEY`)
- Real-time push / webhooks from Metrolinx — confirmed not supported; API is poll-only

---

## Ticket Index

### Frontier (unblocked, open)

- [Task: Create GitHub Repository](tickets/002-create-github-repo.md) — create public repo, wire Vercel
- [Grilling: MCP Primitive Mapping](tickets/004-mcp-primitive-mapping.md) — map API endpoints to Tools/Resources/Prompts
- [Grilling: Caching & Rate Limiting Spec](tickets/005-caching-rate-limiting-spec.md) — decide TTLs and backoff strategy

### Blocked (open, waiting)

- [Grilling: MCP Tool Schema Design](tickets/006-tool-schema-design.md) — blocked by 004
- [Grilling: Project Architecture](tickets/007-project-architecture.md) — blocked by 004, 005, 006
- [Grilling: Test Architecture](tickets/008-test-architecture.md) — blocked by 007
- [Grilling: CI/CD Pipeline Spec](tickets/009-cicd-pipeline-spec.md) — blocked by 002, 003, 008
- [Grilling: Docker & Deployment Spec](tickets/010-docker-deployment-spec.md) — blocked by 007

### Resolved

- [Research: Metrolinx API Inventory](tickets/001-metrolinx-api-inventory.md) — full endpoint inventory, auth confirmed, format selection confirmed
- [Research: Vercel Free Tier Constraints](tickets/003-vercel-constraints.md) — Hobby tier viable, Streamable HTTP confirmed, Node.js runtime, all limits documented
