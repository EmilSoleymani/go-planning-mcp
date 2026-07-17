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

- [Grilling: Docker & Deployment Spec](tickets/010-docker-deployment-spec.md) — full spec in [docs/spec/docker-deployment.md](../docs/spec/docker-deployment.md): multi-stage `node:22-alpine` (port 3000, non-root, liveness-only `/health`, fail-fast env contract), run-only compose with the dev-vs-run split documented in CONTRIBUTING.md, four-block self-hoster README section, and publishing to **both ghcr.io (multi-arch) and npm (`go-transit-mcp`, trusted publishing)** triggered only by `v*` tags — resolving both publishing fog lines. `docs/RELEASING.md` (one-time setup + first-timer runbook) is a required implementation deliverable.
- [Grilling: CI/CD Pipeline Spec](tickets/009-cicd-pipeline-spec.md) — full spec in [docs/spec/cicd-pipeline.md](../docs/spec/cicd-pipeline.md): one sequential keyless `checks` job on Node [20, 22], Vercel built-in Git integration with zero deploy code (gating at merge), smoke cron `17 11 * * 1` with `gh`-CLI auto-issue, single secret (`METROLINX_API_KEY`), squash-only merges with required checks and a phase-two admin-enforcement flip when the scaffold lands. Assumes ticket 002 wires Vercel + the repo secret.
- [Grilling: Test Architecture](tickets/008-test-architecture.md) — full spec in [docs/spec/test-architecture.md](../docs/spec/test-architecture.md): msw at the HTTP seam + hand-built fake client for tools, captured-real JSON fixtures with a refresh script (first capture doubles as ticket-006's empirical verification), 80/70 coverage gate excluding transport glue, smoke = one call per upstream domain validated against Zod outputSchemas (weekly separate workflow, never PR-gating, failures auto-file a `smoke-failure` issue), two-tier Inspector/Desktop manual checklist in CONTRIBUTING.md.
- [Grilling: Project Architecture](tickets/007-project-architecture.md) — full spec in [docs/spec/project-architecture.md](../docs/spec/project-architecture.md): pure ESM + strict TS (NodeNext/ES2022, Node ≥ 20), `tsc`-only build with `tsx` dev, transport-agnostic `buildServer()` with three entry surfaces, one file per tool, co-located unit tests, native `fetch` with GTFS-RT as JSON (no protobuf dep), hand-rolled ADR-0001 retry, four runtime deps (SDK ^1.29, zod ^4, mcp-handler ^1.1), TS ^7, ESLint flat `recommendedTypeChecked` + default Prettier, carets + lockfile.
- [Grilling: MCP Tool Schema Design](tickets/006-tool-schema-design.md) — full schema spec in [docs/spec/tool-schemas.md](../docs/spec/tool-schemas.md): normalized snake_case DTOs (never passthrough, per-call `lang` for French), Zod-backed `outputSchema`/`structuredContent` on all 17 tools, ISO 8601 with Toronto-clock defaults, opaque-string IDs with unified `stop_code`, in-result errors with closed code enum (disambiguation is a success), no pagination (limit + truncated + narrow-filter hints), `plan_trip` gains emulated `arrive_by`, two-mode anti-dump `get_line_schedule`, unfiltered `get_trip_updates` = disruptions-only, resources share mirror tools' serializers.
- [Grilling: Caching & Rate Limiting Spec](tickets/005-caching-rate-limiting-spec.md) — conservative retry ([ADR 0001](../docs/adr/0001-conservative-retry-no-429-retry.md)): 2 retries on network/5xx only (incl. body-tunneled codes), 429 never retried — surfaced to the LLM immediately; 500ms→5s full-jitter backoff. In-process best-effort TTL cache: stops 24h, schedules/fares 6h, real-time never; `CACHE_ENABLED` env var; best-effort on Vercel warm instances, full on Docker.
- [Grilling: MCP Primitive Mapping](tickets/004-mcp-primitive-mapping.md) — 17 snake_case tools incl. composed `plan_trip` (accepts names, fuzzy-resolves to stop codes, disambiguates); GTFS-RT exposed only through filtered tools (never raw full-dataset dumps); alerts folded into one `get_service_alerts(line?, stop?, category?)`; static data ships as Resources (`gotransit://...`) AND mirror tools since many clients ignore resources; three v1 prompts: `plan_a_trip`, `check_my_commute`, `service_status`.
- [Research: Metrolinx API Inventory](tickets/001-metrolinx-api-inventory.md) — 34 GET endpoints across 8 domains (Stop, ServiceUpdate, ServiceataGlance, Schedule, GTFS Feeds, UP GTFS-RT, Fleet, Fares). Auth via `?key=` query param; auth failures return HTTP 200 with `Metadata.ErrorCode: "401"` in body — wrapper must check body not status. Format selection via `Accept` header (documented URL suffix is dead). No sandbox, no push/webhooks, everything is poll. Primitive split: Tools for real-time/query endpoints; Resources for `Stop/All`, `Stop/Details`, daily Schedule/Line; one useful Prompt template (trip-plan scaffold). Open items (non-blocking): numeric rate limit undocumented, OGL licence scope over live responses unconfirmed, GTFS Access and Use Agreement text not retrieved.
- [Research: Vercel Free Tier Constraints](tickets/003-vercel-constraints.md) — Hobby tier is viable, no design change forced. 300s function timeout (default=max, Fluid compute), 4.5 MB body cap (streamed responses exempt), 1M invocations + 4 active-CPU-hrs/month (CPU-hrs is the binding constraint; overage pauses the feature, no bills). Use Node.js runtime (Vercel now recommends against Edge); Streamable HTTP per-POST invocation is Vercel's own documented MCP pattern (`mcp-handler`, Redis only for legacy SSE). PR previews work on Hobby for personal repos (not GitHub-org private repos). Hobby is non-commercial use only. Open items: Protection Bypass on Hobby unverified, no official cold-start ms figure, assume idle scale-to-zero.

## Not yet specified

_(none — the way to the destination is fully charted; only the repo-wiring task remains open)_

## Out of scope

- Moving the owner's hosted instance off Vercel Hobby if the future app/backend becomes commercial (Hobby is non-commercial-use only — fine for this open source project now; revisit as part of the backend effort)

- The frontend app (explicitly deferred to a separate future effort)
- The backend that will eventually consume this MCP server (deferred)
- Per-user authentication on the MCP server itself (self-hosters bring their own `METROLINX_API_KEY`)
- Real-time push / webhooks from Metrolinx — confirmed not supported; API is poll-only

---

## Ticket Index

### Frontier (unblocked, open)

- [Task: Create GitHub Repository](tickets/002-create-github-repo.md) — repo created & pushed; remaining: wire Vercel project + env secret, plus `METROLINX_API_KEY` GitHub Actions repo secret (owner committed to setting it, ticket 008)

### Blocked (open, waiting)

_(none)_

### Resolved

- [Research: Metrolinx API Inventory](tickets/001-metrolinx-api-inventory.md) — full endpoint inventory, auth confirmed, format selection confirmed
- [Research: Vercel Free Tier Constraints](tickets/003-vercel-constraints.md) — Hobby tier viable, Streamable HTTP confirmed, Node.js runtime, all limits documented
- [Grilling: MCP Primitive Mapping](tickets/004-mcp-primitive-mapping.md) — 17-tool roster, composed `plan_trip`, filtered GTFS-RT, Resources + mirror tools, 3 prompts
- [Grilling: Caching & Rate Limiting Spec](tickets/005-caching-rate-limiting-spec.md) — conservative retry (ADR 0001, 429 never retried), in-process TTL cache
- [Grilling: MCP Tool Schema Design](tickets/006-tool-schema-design.md) — full 17-tool schema spec ([docs/spec/tool-schemas.md](../docs/spec/tool-schemas.md)): normalized DTOs, structured output, ISO 8601, unified IDs, error taxonomy, no pagination
- [Grilling: Project Architecture](tickets/007-project-architecture.md) — full project spec ([docs/spec/project-architecture.md](../docs/spec/project-architecture.md)): ESM/strict TS, tsc-only, transport-agnostic core, four runtime deps
- [Grilling: Test Architecture](tickets/008-test-architecture.md) — full test spec ([docs/spec/test-architecture.md](../docs/spec/test-architecture.md)): msw + fake client, captured fixtures, 80/70 gate, schema-validated smoke, two-tier Desktop checklist
- [Grilling: CI/CD Pipeline Spec](tickets/009-cicd-pipeline-spec.md) — full CI/CD spec ([docs/spec/cicd-pipeline.md](../docs/spec/cicd-pipeline.md)): keyless PR checks, Vercel Git integration, smoke cron + auto-issue, squash-only + phased branch protection
- [Grilling: Docker & Deployment Spec](tickets/010-docker-deployment-spec.md) — full deployment spec ([docs/spec/docker-deployment.md](../docs/spec/docker-deployment.md)): node:22-alpine multi-stage, run-only compose, ghcr + npm tag-triggered publishing, RELEASING.md runbook required
