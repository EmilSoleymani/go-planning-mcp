# Docker & Deployment Specification

Resolved by [ticket 010](../../.wayfinder/tickets/010-docker-deployment-spec.md) (grilled 2026-07-17). Builds on the project architecture (ticket 007) and CI/CD spec (ticket 009). This ticket also resolved the map's two publishing fog lines (ghcr.io and npm): **both yes**, release-tag-triggered.

Context fact: Node 20 left maintenance in April 2026. The `engines: >=20` floor and CI matrix remain valid (the floor is about not breaking Node 20 self-hosters); the image we ship uses a supported line.

## 1. Dockerfile

- **Multi-stage on `node:22-alpine`** — Node 22: in LTS maintenance until April 2027 *and* in the CI matrix (never ship a runtime we don't test). Alpine over slim: zero native deps (four pure-JS packages), so musl doesn't bite and the image is ~×3 smaller.
  - Build stage: `npm ci` → `tsc` build → `npm prune --omit=dev`.
  - Runtime stage: copy `dist/`, pruned `node_modules`, `package.json` only.
- **Entrypoint**: `node dist/entry/http.js` (Streamable HTTP). **Port 3000** default; `PORT` env respected.
- **Non-root**: `USER node`.
- **`HEALTHCHECK`** via busybox `wget` against `/health`.
- **Env contract**: `METROLINX_API_KEY` (required — fail fast at startup with a clear message if missing), `PORT`, `CACHE_ENABLED` (ticket 005).

## 2. `/health` endpoint

`GET /health` on the HTTP server returns `200 {"status":"ok"}` — **pure liveness, no upstream Metrolinx call** (a probe hammering a rate-limited upstream every 30s is self-sabotage).

## 3. docker-compose.yml & the dev split

- **Compose is for running the container, not developing in it.** One minimal service: `build: .`, `env_file: .env`, `ports: "3000:3000"`.
- Its two jobs: self-hosters' `docker compose up` quick start, and maintainers smoke-testing the *actual container* (build stage, pruned deps, entrypoint, `/health`) before release.
- **No hot-reload/watch plumbing in compose** — the primary dev loop stays native `npm run dev` (`tsx watch`, ticket 007). Containerized watch duplicates the native loop with worse ergonomics and rots fastest.
- **This split is documented for contributors in `CONTRIBUTING.md` under a "Development workflow" section**: develop with `npm run dev`; use `docker compose up` only to verify the container. (README stays user/self-hoster-facing.)

## 4. Self-hoster documentation (README: "Running your own server")

Four blocks, in order:

1. **Prerequisite**: get a Metrolinx key — registration link, free, up to 10 business days (same canonical phrasing as CONTRIBUTING's key section).
2. **`docker run` one-liner**: `docker run -e METROLINX_API_KEY=xxx -p 3000:3000 ghcr.io/emilsoleymani/go-planning-mcp` — noting what you get: MCP endpoint at `http://localhost:3000/mcp`, health at `/health`.
3. **Compose quick start**: clone → `cp .env.example .env` (add key) → `docker compose up`.
4. **Claude Desktop stdio snippet**: `claude_desktop_config.json` block. With npm publishing decided (§5), the headline form is `npx go-transit-mcp`; the from-source form (`npm ci && npm run build`, then `node dist/entry/stdio.js`) stays as the contributor/dev variant.

Plus one line stating the transport split plainly: *Claude Desktop → stdio; everything else → Streamable HTTP.*

## 5. Publishing — ghcr.io AND npm, tag-triggered

- **ghcr.io: yes.** Without it the `docker run` one-liner is a lie. `release.yml` workflow using the built-in `GITHUB_TOKEN` — no new secrets. **Multi-arch `linux/amd64` + `linux/arm64`** via buildx (Apple Silicon / Raspberry Pi self-hosters).
- **npm: yes** — `go-transit-mcp` (name confirmed unclaimed 2026-07-17). Turns Claude Desktop setup into a one-line `npx` config entry for the primary target client. Published via **npm trusted publishing** (OIDC from Actions) — no `NPM_TOKEN`, one-secret inventory intact, provenance attestation for free.
- **Trigger: git tag `v*` only** — never merge-to-main (doc merges must not churn `latest`; releases are deliberate). Workflow: full `checks` job → ghcr build/push → npm publish. Cutting a release = `npm version patch && git push --follow-tags`.
- **Tagging**: semver cascade + `latest` on ghcr (`v1.2.3` → `1.2.3`, `1.2`, `1`, `latest`) via `docker/metadata-action`; npm gets the same version under the default `latest` dist-tag.

## 6. Release runbook — required deliverable

The owner explicitly needs guided setup for the first releases, so **`docs/RELEASING.md` is a required implementation deliverable**, written for a first-time release operator:

- **One-time setup checklist**: npm account + `go-transit-mcp` trusted-publisher configuration (repo/workflow binding), ghcr package visibility (public) and workflow permissions, branch-protection admin-enforcement flip (the ticket-009 phase-two item lands here too).
- **Per-release runbook**: preflight (green `main`, smoke status, Inspector tier-1 pass per ticket 008), `npm version <patch|minor|major>`, `git push --follow-tags`, watching `release.yml`, verifying the artifacts (`npx go-transit-mcp` + `docker run` of the fresh tag), and what to do when a publish half-fails (e.g. ghcr succeeded, npm failed).
