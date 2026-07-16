---
id: "007"
title: "Grilling: Project Architecture"
type: grilling
status: open
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
