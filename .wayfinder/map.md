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

_(empty — no tickets closed yet)_

## Not yet specified

- Exact retry parameters (retry count, backoff curve, jitter) — depends on Metrolinx API rate limit findings (ticket 001)
- Whether any Resource endpoints warrant in-process caching and at what TTLs — depends on ticket 001
- Exact tool/resource/prompt names and schemas — depends on primitive mapping (ticket 004)
- Whether the Metrolinx API has a sandbox/test environment usable in CI
- Whether ghcr.io image publishing is worth the complexity for v1 or deferred

## Out of scope

- The frontend app (explicitly deferred to a separate future effort)
- The backend that will eventually consume this MCP server (deferred)
- Per-user authentication on the MCP server itself (self-hosters bring their own `METROLINX_API_KEY`)
- Real-time push / webhooks from Metrolinx (if the API doesn't support it — to be confirmed by research)

---

## Ticket Index

### Frontier (unblocked, open)

- [Research: Metrolinx API Inventory](tickets/001-metrolinx-api-inventory.md) — document all endpoints, auth, rate limits, costs
- [Task: Create GitHub Repository](tickets/002-create-github-repo.md) — create public repo, wire Vercel
- [Research: Vercel Free Tier Constraints](tickets/003-vercel-constraints.md) — confirm Streamable HTTP viability, limits

### Blocked (open, waiting)

- [Grilling: MCP Primitive Mapping](tickets/004-mcp-primitive-mapping.md) — blocked by 001
- [Grilling: Caching & Rate Limiting Spec](tickets/005-caching-rate-limiting-spec.md) — blocked by 001
- [Grilling: MCP Tool Schema Design](tickets/006-tool-schema-design.md) — blocked by 004
- [Grilling: Project Architecture](tickets/007-project-architecture.md) — blocked by 004, 005, 006
- [Grilling: Test Architecture](tickets/008-test-architecture.md) — blocked by 007
- [Grilling: CI/CD Pipeline Spec](tickets/009-cicd-pipeline-spec.md) — blocked by 002, 003, 008
- [Grilling: Docker & Deployment Spec](tickets/010-docker-deployment-spec.md) — blocked by 007
