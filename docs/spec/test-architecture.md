# Test Architecture Specification

Resolved by [ticket 008](../../.wayfinder/tickets/008-test-architecture.md) (grilled 2026-07-17). Builds on the project architecture (ticket 007), tool schemas (ticket 006), and ADR 0001.

## 1. Unit & integration tests (every PR, no network, no key)

### Mocking: layered boundaries

- **Client tests use `msw`** (network-level interception; works natively with Node 20 `fetch`). This is where request *construction* is verified: `?key=` param, `Accept` header, retry sequencing (5xx-then-success), and body-tunneled `Metadata.ErrorCode` handling. msw handler sequences express the ADR 0001 retry cases directly.
- **Tool tests inject a hand-built fake client** (plain object implementing the client interface — no mocking library). Tool tests cover input validation, normalization, and the error taxonomy; HTTP realism adds nothing at that layer.
- Ruled out: `nock` (no native-fetch support), bare `vi.fn()` fetch stubs (no URL/header realism at the client layer).

### Fixtures: captured reality

- **Static JSON fixtures captured from the live API**, one file per endpoint family, in `test/fixtures/` — shared by msw handlers and the fake client. Tests never touch the network.
- **`scripts/capture-fixtures.ts`** (manual run, real key) fetches and re-saves all fixtures; diffs on re-capture double as an upstream-drift detector. The *first* capture run is also the empirical verification pass flagged in the tool-schemas spec §5 (E/C/A and S/M enum meanings, live timestamp formats).
- **Hand-written minimal fixtures** only for cases live capture can't produce on demand: body-tunneled 401/429/503 shapes, ambiguous-name inputs.
- Generated/faker mocks ruled out: they encode our assumptions instead of Metrolinx's reality — backwards for a normalization layer.

### What to test

Tool input validation, raw→DTO mapping (incl. enum expansion, time conversion, lang collapse), retry logic per ADR 0001, error taxonomy mapping, fuzzy stop resolution + disambiguation, arrive_by emulation windowing.

### Coverage gate

- Vitest v8 provider, enforced in CI: **80% lines/functions/statements, 70% branches**.
- **Excluded**: `src/entry/`, `api/`, `scripts/` (transport glue — covered by smoke + Desktop checklist instead).
- Rationale: implementation is substantially agent-driven; a moderate floor keeps normalization branches honestly tested without incentivizing assertion-free filler.

## 2. Smoke tests (weekly, live API, real key)

### Scope: one representative call per upstream domain (~10 calls, all 8 domains)

| Call | Domain covered |
|---|---|
| `search_stops("union")` | Stop (Stop/All) |
| `get_stop_details("UN")` | Stop (Details) |
| `get_next_service("UN")` | Stop (NextService) |
| `plan_trip(Union → Oakville, today)` | Schedule (Journey) + fuzzy resolution |
| `list_lines()` + `get_line_schedule("LW", …)` | Schedule (Line) |
| `get_service_alerts()` | ServiceUpdate (alerts) |
| `get_union_departures()` | ServiceUpdate (departures) |
| `get_fares("UN", <Oakville>)` | Fares |
| `get_vehicle_positions(mode: "train")` | ServiceataGlance + GTFS-RT |
| `get_trip_updates()` (unfiltered) | GTFS Feeds |
| `get_fleet_consist(trip from positions call)` | Fleet |

Tools sharing an upstream + mapper with a covered call (e.g. `plan_journey` under `plan_trip`) add no drift-detection value and are omitted.

### Pass criterion

**The tool's Zod `outputSchema` validates the live result** — not HTTP 200. Smoke answers "has Metrolinx drifted out from under our normalization?"; the schemas are the contract. Plus soft invariants where the domain guarantees them (stop list > 100, `list_lines` contains `LW`, fares > 0). **Empty-but-schema-valid is a pass** for real-time tools — no assertion may depend on time of day.

### Operations

- **Separate workflow file** (`.github/workflows/smoke.yml`): weekly schedule + `workflow_dispatch`, uses the `METROLINX_API_KEY` repo secret (owner has committed to setting it), **never gates PRs** — upstream drift must not block unrelated merges. Exact YAML/cron slot is ticket 009's.
- **Failure surfacing: idempotent auto-filed GitHub issue** labeled `smoke-failure` (failing tools + diff summary; updates the existing open issue rather than stacking duplicates). Default Actions email is too easy to miss and invisible to other contributors; an open issue is the repo-native drift signal and gives an agent session something to pick up.
- Runs via `npm run test:smoke` (`vitest run test/smoke`), excluded from the default `test` script.

## 3. Claude Desktop integration (manual, two-tier)

Documented as a **"Verifying against Claude Desktop"** section in `CONTRIBUTING.md`, including the exact config JSON for both dev (`tsx`) and built (`node dist/entry/stdio.js`) forms.

- **Tier 1 — MCP Inspector** (`npx @modelcontextprotocol/inspector`), the per-change workhorse: server launches over stdio; 17 tools listed with schemas; 4 resources readable; 3 prompts render; one happy-path call per tool group; one error-taxonomy case (bad stop code → in-result `not_found`).
- **Tier 2 — Claude Desktop proper**, release-time only: config installs cleanly; server appears; `plan_trip` round-trip in a real conversation; disambiguation flow ("union to oakville"); an error surfaces gracefully in-conversation.
