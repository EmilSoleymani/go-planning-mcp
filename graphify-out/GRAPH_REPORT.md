# Graph Report - go-planning-mcp  (2026-07-21)

## Corpus Check
- 164 files · ~163,299 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 856 nodes · 1928 edges · 53 communities (50 shown, 3 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 50 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `cb61deba`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Metrolinx API Client & Error Handling
- ADR Rationale & Design Decisions
- Journey/Line-Schedule Normalization
- MCP Server Transports (stdio/http)
- Line Listing & Ambiguity Resolution
- Prompt & Tool Test Fixtures
- Raw Metrolinx API Response Types
- TypeScript & Vitest Tooling Config
- Service Alerts Normalization
- GTFS Trip Updates Normalization
- Lint/Format/Mock Dev Dependencies
- Fleet Consist Normalization
- Vehicle Positions Normalization
- Service Exceptions Normalization
- Trip Status Normalization
- Wayfinder Map & Vercel Research
- Metrolinx Client Test Fixtures
- Fixture Capture Script
- Stop Search & Resolution
- Release Workflow & Publishing Runbook
- normalize/line-schedule.ts
- Smoke Testing & Repo/CI Setup
- Package Metadata
- npm Scripts
- Service Guarantee Normalization
- normalize/fares.ts
- Contributor Workflow & Self-Hosting Docs
- TypeScript Build Config
- MCP Tool/Prompt Design Decisions
- Project Architecture & Docker Spec
- CI/CD & Test Architecture Specs
- Journey/Trip Planning Tests
- Journey Composition Tests (ADR-0002)
- Union Departures Tests
- MCP SDK Dependencies
- Metrolinx API Access & Licensing Research
- Test Architecture Overview
- Vehicle Positions Tests
- MCP Resources Tests
- Vercel Deployment Config
- Manual Verification Checklists
- Release Workflow Jobs
- Dependency Overrides
- Package Repository Metadata
- Multi-hub transfer composition is capped at one transfer
- Fixture Loader Tests
- tools/search-stops.ts
- GO Planning MCP Server
- tools/search-stops.test.ts
- CLAUDE.md

## God Nodes (most connected - your core abstractions)
1. `MetrolinxError` - 48 edges
2. `MetrolinxClient` - 43 edges
3. `toToolErrorResult()` - 36 edges
4. `MetrolinxHttpClient` - 31 edges
5. `toIsoWithTorontoOffset()` - 23 edges
6. `registerTools()` - 22 edges
7. `fakeClient()` - 22 edges
8. `callTool()` - 21 edges
9. `RawStopAllResponse` - 20 edges
10. `docs/TOOLS.md — Tools Reference` - 20 edges

## Surprising Connections (you probably didn't know these)
- `MCP Endpoint Notice (/api/mcp)` --shares_data_with--> `Directory Layout`  [INFERRED]
  public/index.html → docs/spec/project-architecture.md
- `registerSearchStops()` --indirect_call--> `query()`  [INFERRED]
  src/tools/search-stops.ts → src/normalize/journey.test.ts
- `Ticket 009: Grilling — CI/CD Pipeline Spec` --references--> `CI Workflow (ci.yml)`  [EXTRACTED]
  .wayfinder/tickets/009-cicd-pipeline-spec.md → .github/workflows/ci.yml
- `Release Workflow (release.yml)` --references--> `ghcr.io + npm dual publish`  [INFERRED]
  .github/workflows/release.yml → .wayfinder/tickets/010-docker-deployment-spec.md
- `Ticket 002: Task — Create GitHub Repository` --references--> `METROLINX_API_KEY secret (smoke job)`  [EXTRACTED]
  .wayfinder/tickets/002-create-github-repo.md → .github/workflows/smoke.yml

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Wayfinder Map Decision Log** — _wayfinder_map, _wayfinder_tickets_001_metrolinx_api_inventory, _wayfinder_tickets_002_create_github_repo, _wayfinder_tickets_003_vercel_constraints, _wayfinder_tickets_004_mcp_primitive_mapping, _wayfinder_tickets_005_caching_rate_limiting_spec, _wayfinder_tickets_006_tool_schema_design, _wayfinder_tickets_007_project_architecture, _wayfinder_tickets_008_test_architecture, _wayfinder_tickets_009_cicd_pipeline_spec, _wayfinder_tickets_010_docker_deployment_spec [EXTRACTED 1.00]
- **CI/CD Pipeline Workflows (ci/release/smoke) implementing ticket 009** — _github_workflows_ci, _github_workflows_release, _github_workflows_smoke, _wayfinder_tickets_009_cicd_pipeline_spec [INFERRED 0.95]
- **Metrolinx API research feeding downstream design tickets** — _wayfinder_tickets_001_metrolinx_api_inventory, _wayfinder_research_handoff_001_metrolinx_api_research, _wayfinder_tickets_004_mcp_primitive_mapping, _wayfinder_tickets_005_caching_rate_limiting_spec, _wayfinder_tickets_006_tool_schema_design [INFERRED 0.85]
- **Weekly Smoke Test Domain Coverage** — docs_spec_test_architecture_smoke_tests, docs_tools_search_stops, docs_tools_get_stop_details, docs_tools_get_next_service, docs_tools_plan_trip, docs_tools_list_lines, docs_tools_get_line_schedule, docs_tools_get_service_alerts, docs_tools_get_union_departures, docs_tools_get_fares, docs_tools_get_vehicle_positions, docs_tools_get_trip_updates, docs_tools_get_fleet_consist [EXTRACTED 1.00]
- **Wayfinder Spec Documents Dependency Chain** — docs_spec_project_architecture, docs_spec_tool_schemas, docs_spec_test_architecture, docs_spec_cicd_pipeline, docs_spec_docker_deployment [EXTRACTED 1.00]
- **One-Time Release Setup Checklist** — docs_releasing_npm_account, docs_releasing_npm_trusted_publisher, docs_releasing_ghcr_package_visibility, docs_releasing_ghcr_workflow_permissions, docs_releasing_branch_protection_admin_enforcement [EXTRACTED 1.00]

## Communities (53 total, 3 thin omitted)

### Community 0 - "Metrolinx API Client & Error Handling"
Cohesion: 0.12
Nodes (28): toToolErrorResult(), MetrolinxClient, planItineraries(), normalizeListLines(), buildStopNameIndex(), registerPrompts(), firstValue(), jsonResourceResult() (+20 more)

### Community 1 - "ADR Rationale & Design Decisions"
Cohesion: 0.07
Nodes (68): ADR 0001: Never Retry HTTP 429 (Conservative Retry Policy), Rejected Alternative: 3 Retries with 429 Retryable, Deferred: General Multi-Hub Bus Composition, Rejected: LLM-Orchestrated Segment Composition, Rejected: Separate plan_trip_with_transfers Tool, ADR 0002: plan_trip Composes Cross-Line Transfers via Union, Runtime Dependencies (4, Deliberately Minimal), Smoke Tests (Weekly, Live API, Real Key) (+60 more)

### Community 2 - "Journey/Line-Schedule Normalization"
Cohesion: 0.08
Nodes (46): RawJourneyResponse, RawNextServiceLine, RawNextServiceResponse, combine(), composeViaUnion(), fetchDirectOrComposed(), fetchItineraries(), firstAndLastByOrder() (+38 more)

### Community 3 - "MCP Server Transports (stdio/http)"
Cohesion: 0.06
Nodes (27): client, handler, ADR-0001, client, handleMcp(), httpServer, methodNotAllowed(), port (+19 more)

### Community 4 - "Line Listing & Ambiguity Resolution"
Cohesion: 0.13
Nodes (14): Ambiguity, ambiguitySchema, Itinerary, ItineraryLeg, itineraryLegSchema, itinerarySchema, legStopSchema, maxResultsSchema (+6 more)

### Community 5 - "Prompt & Tool Test Fixtures"
Cohesion: 0.14
Nodes (16): buildServer(), fixture, allFixture, engineFixture, fixture, fixture, fixture, fixture (+8 more)

### Community 6 - "Raw Metrolinx API Response Types"
Cohesion: 0.07
Nodes (28): RawAlertLine, RawAlertStop, RawAlertTrip, RawConsistCar, RawFacility, RawFareCategory, RawFareEntry, RawFareTicket (+20 more)

### Community 7 - "TypeScript & Vitest Tooling Config"
Cohesion: 0.08
Nodes (23): api, ES2022, node, scripts, test, vitest.config.ts, vitest.smoke.config.ts, compilerOptions (+15 more)

### Community 8 - "Service Alerts Normalization"
Cohesion: 0.12
Nodes (18): RawAlertMessage, RawAlertsResponse, AlertFeed, expandStatus(), normalizeMessage(), normalizeServiceAlerts(), pickLang(), ServiceAlertsFilters (+10 more)

### Community 9 - "GTFS Trip Updates Normalization"
Cohesion: 0.13
Nodes (21): RawGtfsStopTimeEvent, RawGtfsStopTimeUpdate, RawGtfsTripUpdate, RawGtfsTripUpdatesResponse, expandScheduleRelationship(), lastSegment(), normalizeOne(), normalizeStopUpdate() (+13 more)

### Community 10 - "Lint/Format/Mock Dev Dependencies"
Cohesion: 0.10
Nodes (21): eslint, eslint-config-prettier, @eslint/js, msw, devDependencies, eslint, eslint-config-prettier, @eslint/js (+13 more)

### Community 11 - "Fleet Consist Normalization"
Cohesion: 0.17
Nodes (15): RawConsist, RawFleetConsistResponse, findConsistByTrip(), firstConsist(), normalizeFleetConsist(), allFixture, engineFixture, ConsistCar (+7 more)

### Community 12 - "Vehicle Positions Normalization"
Cohesion: 0.24
Nodes (14): RawStopListEntry, matchesFilter(), matchTier(), normalizeAllStops(), normalizeSearchStops(), normalizeText(), resolveStopByName(), resolveStopCode() (+6 more)

### Community 13 - "Service Exceptions Normalization"
Cohesion: 0.17
Nodes (16): RawExceptionStop, RawExceptionTrip, RawServiceExceptionsResponse, normalizeServiceExceptions(), normalizeStop(), normalizeTrip(), scheduledTime(), fixture (+8 more)

### Community 14 - "Trip Status Normalization"
Cohesion: 0.09
Nodes (25): RawLineAllEntry, RawLineAllResponse, RawTripStatusEntry, RawTripStatusStop, modesOf(), normalizeLine(), fixture, buildStopNames() (+17 more)

### Community 15 - "Wayfinder Map & Vercel Research"
Cohesion: 0.18
Nodes (17): GO Transit MCP Server — Wayfinder Map, GO Transit MCP Server (project), Research Report — Vercel Hobby Tier Constraints, Vercel Fluid Compute, mcp-handler npm package, MCP Streamable HTTP transport (Vercel deployment pattern), Vercel Hobby (Free) Tier, Ticket 001: Research — Metrolinx API Inventory (+9 more)

### Community 16 - "Metrolinx Client Test Fixtures"
Cohesion: 0.06
Nodes (35): alertsFixture, destinationsFixture, exceptionsFixture, fixture, guaranteeFixture, journeyFixture, lineAllFixture, lineScheduleFixture (+27 more)

### Community 17 - "Fixture Capture Script"
Cohesion: 0.17
Nodes (13): API_KEY, fetchJson(), FIXTURES_DIR, FleetConsistResponse, hhmm(), LineAllResponse, main(), NextServiceResponse (+5 more)

### Community 18 - "Stop Search & Resolution"
Cohesion: 0.20
Nodes (13): RawUnionDeparturesResponse, RawUnionTrip, normalizeMode(), normalizeTrip(), normalizeUnionDepartures(), resolveStopCode(), fixture, stopAll (+5 more)

### Community 19 - "Release Workflow & Publishing Runbook"
Cohesion: 0.19
Nodes (13): CI Workflow (ci.yml), Release Workflow (release.yml), ghcr.io + npm dual publish, Branch Protection Admin Enforcement Flip, ghcr Workflow Permissions, npm Account Setup, npm Trusted Publisher Binding, Per-Release Runbook (+5 more)

### Community 20 - "normalize/line-schedule.ts"
Cohesion: 0.18
Nodes (13): RawLineScheduleResponse, RawLineScheduleStop, RawLineScheduleTrip, firstAndLastStop(), normalizeLineSchedule(), stopTimeTrip(), summaryTrip(), fixture (+5 more)

### Community 21 - "Smoke Testing & Repo/CI Setup"
Cohesion: 0.19
Nodes (13): Smoke Workflow (smoke.yml), METROLINX_API_KEY secret (smoke job), smoke-failure auto-issue mechanism, Ticket 002: Task — Create GitHub Repository, go-planning-mcp GitHub repo, go-planning-mcp Vercel project, Ticket 008: Grilling — Test Architecture, 80/70 coverage gate (+5 more)

### Community 22 - "Package Metadata"
Cohesion: 0.15
Nodes (12): author, bin, go-transit-mcp, description, engines, node, files, license (+4 more)

### Community 23 - "npm Scripts"
Cohesion: 0.15
Nodes (13): scripts, build, dev, format, format:check, lint, mcp-inspector, start:http (+5 more)

### Community 24 - "Service Guarantee Normalization"
Cohesion: 0.19
Nodes (13): RawServiceGlanceTrip, buildOccupancyMap(), buildStopNameMap(), lastSegment(), normalizeVehicle(), normalizeVehiclePositions(), VehicleMode, VehiclePositionFilters (+5 more)

### Community 25 - "normalize/fares.ts"
Cohesion: 0.22
Nodes (10): RawFaresResponse, normalizeFares(), normalizeMethod(), RIDER_BY_CATEGORY, fixture, Fare, fareSchema, faresOutputSchema (+2 more)

### Community 26 - "Contributor Workflow & Self-Hosting Docs"
Cohesion: 0.21
Nodes (10): Development Workflow: native dev, container only for verification, Getting a Metrolinx API Key, go-transit-mcp docker-compose service, ghcr Package Visibility, Secrets & Contributor Documentation, docker-compose.yml & the Dev Split, Self-Hoster Documentation (README), Package Scripts & Bin (+2 more)

### Community 27 - "TypeScript Build Config"
Cohesion: 0.17
Nodes (11): src/**/*.test.ts, ./tsconfig.json, compilerOptions, noEmit, outDir, rootDir, sourceMap, exclude (+3 more)

### Community 28 - "MCP Tool/Prompt Design Decisions"
Cohesion: 0.27
Nodes (10): Ticket 004: Grilling — MCP Primitive Mapping, 17-tool roster, get_service_alerts tool, plan_trip tool, Resources + mirror-tools pattern, v1 Prompts (plan_a_trip, check_my_commute, service_status), Ticket 006: Grilling — MCP Tool Schema Design, In-result error taxonomy (+2 more)

### Community 29 - "Project Architecture & Docker Spec"
Cohesion: 0.31
Nodes (8): Dockerfile Spec (multi-stage, node:22-alpine), /health Endpoint Spec (Pure Liveness), Build Tooling: tsc Only, No Bundler, Directory Layout, Module System & TypeScript Baseline (Pure ESM), Wayfinder Ticket 005: Caching/Retry Policy, Wayfinder Ticket 007: Project Architecture, Wayfinder Ticket 010: Docker Deployment Spec

### Community 30 - "CI/CD & Test Architecture Specs"
Cohesion: 0.28
Nodes (7): Vercel Deployment (Built-in Git Integration), PR Checks (ci.yml), Weekly Smoke Workflow (smoke.yml), Wayfinder Ticket 002: Repo Task, Wayfinder Ticket 003: Vercel Constraints, Wayfinder Ticket 008: Test Architecture, Wayfinder Ticket 009: CI/CD Pipeline Spec

### Community 31 - "Journey/Trip Planning Tests"
Cohesion: 0.15
Nodes (10): MetrolinxError, MetrolinxErrorCode, fixture, emptyFeed, serviceFixture, fixture, fixture, ambiguous (+2 more)

### Community 32 - "Journey Composition Tests (ADR-0002)"
Cohesion: 0.33
Nodes (7): RawStopDetailsResponse, ACCESSIBILITY_FACILITY_CODES, normalizeStopDetails(), pickLang(), metadata, getStopDetailsInputShape, StopDetails

### Community 33 - "Union Departures Tests"
Cohesion: 0.14
Nodes (11): RawStopAllResponse, RawTripStatusResponse, stopAllFixture, tripFixture, stopAllFixture, tripFixture, fixture, stopAll (+3 more)

### Community 34 - "MCP SDK Dependencies"
Cohesion: 0.29
Nodes (7): mcp-handler, @modelcontextprotocol/sdk, dependencies, mcp-handler, @modelcontextprotocol/sdk, zod, zod

### Community 35 - "Metrolinx API Access & Licensing Research"
Cohesion: 0.33
Nodes (6): Metrolinx Open Data API — Inventory & Access Research, Body-tunneled auth-failure quirk, Fleet/Occupancy GtfsRT endpoints (undocumented auth gate), GO Transit GTFS Access and Use Agreement, Metrolinx Open Data API (GO API), Open Government Licence – Ontario – Metrolinx

### Community 36 - "Test Architecture Overview"
Cohesion: 0.40
Nodes (5): Dev Dependencies & Config, Coverage Gate (80% Lines/Fn/Stmt, 70% Branches), Fixtures: Captured Reality, Mocking: Layered Boundaries (msw vs Fake Client), Unit & Integration Tests

### Community 37 - "Vehicle Positions Tests"
Cohesion: 0.22
Nodes (6): planTripOutputSchema, stopDetailsSchema, tripUpdatesOutputSchema, unionDeparturesOutputSchema, CallToolOutcome, client

### Community 38 - "MCP Resources Tests"
Cohesion: 0.40
Nodes (3): lineAll, stopAll, stopDetails

### Community 39 - "Vercel Deployment Config"
Cohesion: 0.40
Nodes (4): buildCommand, framework, outputDirectory, $schema

### Community 40 - "Manual Verification Checklists"
Cohesion: 0.83
Nodes (4): Tier 1 — MCP Inspector Checklist, Tier 2 — Claude Desktop Proper Checklist, Verifying against Claude Desktop, Claude Desktop Integration (Manual, Two-Tier)

### Community 41 - "Release Workflow Jobs"
Cohesion: 0.67
Nodes (3): checks job (release.yml), publish-ghcr job, publish-npm job

### Community 42 - "Dependency Overrides"
Cohesion: 0.67
Nodes (3): @modelcontextprotocol/sdk, overrides, mcp-handler

### Community 43 - "Package Repository Metadata"
Cohesion: 0.67
Nodes (3): repository, type, url

### Community 44 - "Multi-hub transfer composition is capped at one transfer"
Cohesion: 0.29
Nodes (6): Call budget: K=3, sequential, early-exit; arrive_by wide retry K=1, Hub set: a curated table, not derived, Multi-hub transfer composition is capped at one transfer, Per-query hub selection: geometric detour ranking, Result honesty: an optional `composed: true` flag, Transfer buffers: per-hub column, default 10, one launch override

### Community 49 - "tools/search-stops.ts"
Cohesion: 0.33
Nodes (5): searchStopsInputShape, searchStopsOutputSchema, SearchStopsResult, StopMatch, stopMatchSchema

### Community 50 - "GO Planning MCP Server"
Cohesion: 0.50
Nodes (3): GO Planning MCP Server, Language, Trip composition

## Knowledge Gaps
- **267 isolated node(s):** `client`, `handler`, `name`, `version`, `description` (+262 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `MetrolinxClient` connect `Metrolinx API Client & Error Handling` to `Journey Composition Tests (ADR-0002)`, `Journey/Line-Schedule Normalization`, `MCP Server Transports (stdio/http)`, `Prompt & Tool Test Fixtures`, `Service Alerts Normalization`, `GTFS Trip Updates Normalization`, `Fleet Consist Normalization`, `Service Exceptions Normalization`, `Metrolinx Client Test Fixtures`, `tools/search-stops.ts`, `Stop Search & Resolution`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._
- **Why does `MetrolinxError` connect `Journey/Trip Planning Tests` to `Journey Composition Tests (ADR-0002)`, `Union Departures Tests`, `Journey/Line-Schedule Normalization`, `MCP Server Transports (stdio/http)`, `Metrolinx API Client & Error Handling`, `Prompt & Tool Test Fixtures`, `GTFS Trip Updates Normalization`, `Fleet Consist Normalization`, `Service Exceptions Normalization`, `Trip Status Normalization`, `Metrolinx Client Test Fixtures`, `tools/search-stops.ts`, `Stop Search & Resolution`, `tools/search-stops.test.ts`, `normalize/line-schedule.ts`, `normalize/fares.ts`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._
- **Why does `MetrolinxHttpClient` connect `MCP Server Transports (stdio/http)` to `Metrolinx API Client & Error Handling`, `Metrolinx Client Test Fixtures`, `Vehicle Positions Tests`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **What connects `client`, `handler`, `name` to the rest of the system?**
  _267 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Metrolinx API Client & Error Handling` be split into smaller, more focused modules?**
  _Cohesion score 0.12019566736547868 - nodes in this community are weakly interconnected._
- **Should `ADR Rationale & Design Decisions` be split into smaller, more focused modules?**
  _Cohesion score 0.06862745098039216 - nodes in this community are weakly interconnected._
- **Should `Journey/Line-Schedule Normalization` be split into smaller, more focused modules?**
  _Cohesion score 0.07617051013277429 - nodes in this community are weakly interconnected._