---
id: "007"
title: "Grilling: Project Architecture"
type: grilling
status: resolved
assignee: emil
blocked_by: ["004", "005", "006"]
blocks: ["008", "010"]
---

## Question

Finalise the project structure and build configuration:

**Directory layout**
- Where does core MCP server logic live (`src/server.ts`)?
- Where do Metrolinx API client modules live?
- Where do the two entry points live (`stdio.ts`, `http.ts`)?
- Where does the Vercel adapter live (`api/mcp.ts`)?
- Where do tests live (co-located vs `__tests__/` vs `test/`)?

**Build tooling**
- TypeScript config: target, module system (ESM vs CJS), strict mode settings
- Build tool: `tsc` only, or a bundler (esbuild, tsup) for faster builds and smaller output?
- Package scripts: `build`, `start:stdio`, `start:http`, `test`, `test:smoke`

**Runtime dependencies**
- `@modelcontextprotocol/sdk` — version to pin
- HTTP client for Metrolinx API (`node-fetch`, `undici`, or native `fetch`)?
- Any retry library or implement from scratch?

**Dev dependencies**
- Vitest for testing
- ESLint + Prettier config
- TypeScript version to pin

## Answer

Grilled 2026-07-17. Full spec: [docs/spec/project-architecture.md](../../docs/spec/project-architecture.md). Eight decisions, all confirmed one-by-one:

1. **Pure ESM, strict TS**: `"type": "module"`, NodeNext, ES2022, `strict` + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`, Node ≥ 20.
2. **`tsc` only for build, `tsx` for dev** — no bundler; Vercel bundles `api/` itself, and build = typecheck means no drift.
3. **Layout**: transport-agnostic `src/server.ts` (`buildServer()`), `src/entry/{stdio,http}.ts`, `api/mcp.ts` Vercel adapter, `src/metrolinx/` client layer, shared `src/schemas/` (the ticket-006 no-drift mechanism), `src/normalize/`, **one file per tool** in `src/tools/`, co-located unit tests + `test/` for integration/smoke.
4. **Native `fetch`, zero HTTP deps**; GTFS-RT consumed as JSON — no protobuf/`gtfs-realtime-bindings`.
5. **Retry hand-rolled** in `client.ts` per ADR 0001 (generic libraries can't model body-tunneled retryability).
6. **Four runtime deps** (`@modelcontextprotocol/sdk` ^1.29, `zod` ^4*, `mcp-handler` ^1.1), caret ranges + lockfile + `npm ci`; TypeScript ^7. *Zod-4-vs-SDK peer range verified at scaffold time.
7. **ESLint 10 flat config + `recommendedTypeChecked`, default Prettier** (sole formatter, `eslint-config-prettier`).
8. **Scripts** as specced (`dev`, `build`, `start:stdio`/`start:http`, `typecheck`, `test`/`test:watch`/`test:smoke`, `lint`, `format`); `bin: go-transit-mcp` for future `npx` use — npm publishing itself deferred to the map's fog alongside ghcr.io.
