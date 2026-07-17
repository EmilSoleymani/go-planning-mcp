# Project Architecture Specification

Resolved by [ticket 007](../../.wayfinder/tickets/007-project-architecture.md) (grilled 2026-07-17). Builds on the tool schemas (ticket 006), caching/retry policy (ticket 005 / ADR 0001), and Vercel constraints (ticket 003).

## 1. Module system & TypeScript baseline

- **Pure ESM**: `"type": "module"`; no CJS build, ever (application, not a library).
- `tsconfig`: `module: "NodeNext"`, `moduleResolution: "NodeNext"`, `target: "ES2022"`, `strict: true`, plus `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` — Metrolinx responses are full of maybe-null fields; these flags force the normalization layer to handle them honestly.
- **Node ≥ 20** (`engines` field): LTS floor, native `fetch`, supported by Vercel and Docker base images.

## 2. Build tooling

- **`tsc` only** — emits `dist/` for stdio + Docker; compiler is the typechecker, so build and typecheck cannot drift. No bundler: Vercel compiles/bundles `api/` functions itself, and nothing here needs single-file output. (tsup can be added later if image size/startup ever matters — a one-day change.)
- **`tsx`** for dev-time execution (watch mode, no build step).
- `tsconfig.build.json` extends the root config, excludes tests.

## 3. Directory layout

```
api/mcp.ts               # Vercel adapter (mcp-handler) — thin, imports buildServer()
src/
  server.ts              # buildServer(): registers all tools/resources/prompts; no transport code
  entry/
    stdio.ts             # bin entry for Claude Desktop
    http.ts              # standalone Streamable HTTP server for Docker
  metrolinx/
    client.ts            # fetch + ?key auth + Accept header + retry (ADR 0001) + Metadata error tunneling
    cache.ts             # TTL cache (ticket 005)
    types.ts             # raw Metrolinx response types (PascalCase, as-is)
  schemas/               # Zod DTOs from ticket 006 — single source for outputSchema, tools AND resources
  normalize/             # raw → DTO mappers (enum expansion, time conversion, lang collapse)
  tools/                 # one file per tool (17 files: plan-trip.ts, search-stops.ts, …)
  resources/             # the 4 URIs, importing the same schemas/ + normalize/
  prompts/               # the 3 prompt templates
  errors.ts              # error taxonomy (tool-schemas spec §1.5)
  time.ts                # Toronto clock, ISO 8601 conversions, service-day normalization
test/                    # cross-cutting integration + smoke tests only
```

- **One file per tool** (17 small files): each is a self-contained unit — input schema, output schema, handler — small, greppable, independently reviewable.
- **Unit tests co-located** (`src/**/*.test.ts`); top-level `test/` only for cross-cutting integration/smoke suites. Details of the test strategy are ticket 008's scope.
- `server.ts` is transport-agnostic by construction; all three entry surfaces (stdio, standalone HTTP, Vercel) call the same `buildServer()`.

## 4. Runtime dependencies (four, deliberately minimal)

| Package | Range | Role |
|---|---|---|
| `@modelcontextprotocol/sdk` | `^1.29` | MCP server + transports |
| `zod` | `^4` * | Input/output schemas (ticket 006) |
| `mcp-handler` | `^1.1` | Vercel adapter only |
| — | — | HTTP: **native `fetch`** (no node-fetch/undici dep) |

\* Verify at scaffold time that the SDK's Zod peer-range accepts Zod 4; if it still tracks Zod 3, follow the SDK's range — schemas are written against whatever it accepts.

- **GTFS-RT consumed as JSON** (via `Accept` header) — no `gtfs-realtime-bindings`/protobuf dependency; also sidesteps the inconsistent protobuf support across Metrolinx's three GTFS-RT families.
- **Retry hand-rolled** in `metrolinx/client.ts` (~30 lines): the ADR 0001 policy's trickiest part — HTTP 200 with body-tunneled `Metadata.ErrorCode: "503"` is retryable while `"429"` is not — is exactly what generic retry libraries don't model. Unit-tested against the ADR's cases.

## 5. Dev dependencies & config

- `typescript` `^7` (Go-native compiler line; fall back to 6.x only if typescript-eslint/Vitest lag at scaffold time — one-line change).
- `vitest` `^4`, `tsx`, `eslint` `^10` + `typescript-eslint` (**flat config**, `recommendedTypeChecked` preset — type-aware linting for async normalization code), `prettier` (default config, sole formatter) + `eslint-config-prettier`.
- **Pinning strategy**: caret ranges + committed `package-lock.json` + `npm ci` in CI. For an application the lockfile is the pin.

## 6. Package scripts & bin

```jsonc
{
  "dev":          "tsx watch src/entry/http.ts",
  "build":        "tsc -p tsconfig.build.json",
  "start:stdio":  "node dist/entry/stdio.js",
  "start:http":   "node dist/entry/http.js",
  "typecheck":    "tsc --noEmit",
  "test":         "vitest run",              // unit + integration, no network
  "test:watch":   "vitest",
  "test:smoke":   "vitest run test/smoke",   // live API with real key; never in default test
  "lint":         "eslint .",
  "format":       "prettier --write .",
  "format:check": "prettier --check ."
}
```

- `bin`: `"go-transit-mcp": "dist/entry/stdio.js"` — enables `npx`-style Claude Desktop setup if the package is ever published. Whether to publish to npm is **undecided** (tracked in the map's Not-yet-specified alongside the ghcr.io question).
- `test:smoke` is a script contract only; its contents are ticket 008's scope.
