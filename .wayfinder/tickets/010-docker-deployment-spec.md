---
id: "010"
title: "Grilling: Docker & Deployment Spec"
type: grilling
status: resolved
assignee: emil
blocked_by: ["007"]
blocks: []
---

## Question

Spec the container and local development experience:

**Dockerfile**
- Multi-stage build: build stage (full Node + TypeScript) → runtime stage (Node slim/alpine)?
- Which Node.js base image version and variant?
- What's the container entrypoint — `http.ts` (Streamable HTTP server)?
- What port does the container expose?
- How is `METROLINX_API_KEY` documented for the `docker run` command?

**docker-compose.yml**
- What does local development look like? (`docker compose up` starts the HTTP server?)
- Should the compose file also include a watch mode with hot reload?
- Environment variable handling — `.env` file pattern?

**Self-hoster documentation**
- `docker run` one-liner with env var
- `docker compose` quick start
- Claude Desktop `claude_desktop_config.json` snippet for stdio mode
- Health check endpoint — should the HTTP server expose `GET /health`?

**Image publishing**
- Should the project publish a Docker image to GitHub Container Registry (ghcr.io)?
- If yes, which CI event triggers a publish (merge to main? tagged release?)
- Image tagging strategy: `latest` + semver tags?

## Answer

Grilled 2026-07-17. Full spec: [docs/spec/docker-deployment.md](../../docs/spec/docker-deployment.md). Four decisions, all confirmed; this ticket also closed the map's two publishing fog lines:

1. **Dockerfile**: multi-stage `node:22-alpine` (supported until 2027-04 and in the CI matrix; Node 20 EOL'd 2026-04), runtime stage = `dist/` + pruned deps, entrypoint `node dist/entry/http.js`, port 3000/`PORT`, `USER node`, busybox-wget `HEALTHCHECK`, fail-fast if `METROLINX_API_KEY` missing. **`GET /health` = pure liveness, never calls Metrolinx.**
2. **Compose is run-only** (one minimal service, `env_file: .env`): self-hoster quick start + pre-release container smoke-testing. No hot-reload plumbing — dev loop stays native `tsx watch`; **the split is documented in CONTRIBUTING.md ("Development workflow")** per owner request.
3. **README "Running your own server"**: four blocks — key prerequisite, `docker run` one-liner, compose quick start, Claude Desktop snippet (headline form `npx go-transit-mcp` now that npm is a yes).
4. **Publish to BOTH ghcr.io and npm** (`go-transit-mcp` confirmed unclaimed), triggered **only by `v*` tags** via one `release.yml`: checks → multi-arch (amd64+arm64) buildx push with semver-cascade + `latest` tags → npm publish via trusted publishing (OIDC, no token secret). **Owner needs guided setup → `docs/RELEASING.md` is a required implementation deliverable**: one-time setup checklist (npm trusted publisher, ghcr visibility/permissions, the ticket-009 branch-protection flip) + first-timer per-release runbook incl. half-failure recovery.
