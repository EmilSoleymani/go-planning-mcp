---
id: "008"
title: "Grilling: Test Architecture"
type: grilling
status: resolved
assignee: emil
blocked_by: ["007"]
blocks: ["009"]
---

## Question

Spec the full test strategy:

**Unit tests (run on every PR, no API key needed)**
- How is the Metrolinx HTTP client mocked? (`msw`, `nock`, Vitest's built-in mocking, or manual stubs?)
- What fixture strategy — static JSON files or generated mocks?
- What to test: tool input validation, response mapping, retry logic, error surfaces
- Coverage expectations — is there a minimum threshold to enforce in CI?

**Smoke tests (run weekly against real Metrolinx API)**
- Which tools/endpoints are covered by smoke tests? (All? A representative subset?)
- What constitutes a passing smoke test — HTTP 200? Specific response fields present?
- How are smoke test failures surfaced? (GitHub Actions alert? Email?)
- Does the smoke test suite run in a separate workflow file from the unit test suite?

**Claude Desktop integration testing**
- Is there a manual test checklist for verifying the MCP server works end-to-end with Claude Desktop?
- Should this be documented as a contributor guide section?

## Answer

Grilled 2026-07-17. Full spec: [docs/spec/test-architecture.md](../../docs/spec/test-architecture.md). Six decisions, all confirmed one-by-one:

1. **Layered mocking**: `msw` at the HTTP seam for client tests (verifies `?key=`, `Accept`, ADR-0001 retry sequencing, body-tunneled errors); hand-built fake client injected into tool tests (validation/normalization/error taxonomy). `nock` ruled out (no native-fetch support).
2. **Fixtures = captured reality**: static JSON from the live API in `test/fixtures/`, refreshed via `scripts/capture-fixtures.ts` (re-capture diffs double as drift detection; first capture is the ticket-006 empirical verification pass). Hand-written fixtures only for unreachable edge cases (tunneled 401/429/503). Generated mocks ruled out.
3. **Coverage gate**: 80% lines/functions/statements, 70% branches (Vitest v8), excluding `src/entry/`, `api/`, `scripts/`.
4. **Smoke scope**: one representative call per upstream domain (~10 calls, all 8 domains); **pass = live result validates against the tool's Zod `outputSchema`** + soft invariants; empty-but-valid passes (no time-of-day-dependent assertions).
5. **Smoke ops**: separate `.github/workflows/smoke.yml` (weekly + manual dispatch, never PR-gating, uses `METROLINX_API_KEY` repo secret — owner setting it); failures surface as an **idempotent auto-filed `smoke-failure` GitHub issue**. YAML/cron details → ticket 009.
6. **Claude Desktop**: two-tier manual checklist in `CONTRIBUTING.md` — MCP Inspector per change (17 tools/4 resources/3 prompts + error case), full Desktop pass at release time only.
