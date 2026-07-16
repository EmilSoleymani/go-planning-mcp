---
id: "008"
title: "Grilling: Test Architecture"
type: grilling
status: open
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
