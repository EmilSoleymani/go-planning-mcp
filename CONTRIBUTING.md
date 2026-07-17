# Contributing

## Development workflow

Develop natively — don't develop inside the container.

```bash
npm ci
npm run dev   # tsx watch src/entry/http.ts
```

`npm run dev` is the primary dev loop: fast, hot-reloading, no build step.

`docker compose up` is **not** a dev loop — it's for verifying the actual
container (build stage, pruned `node_modules`, non-root entrypoint,
`/health`) before a release. It has no hot-reload/watch plumbing on purpose;
containerized watch would just duplicate `npm run dev` with worse ergonomics.
Use it like this:

```bash
cp .env.example .env   # add your METROLINX_API_KEY
docker compose up
```

Before opening a PR, run the same checks CI runs:

```bash
npm run build
npm run lint
npm run format:check
npm run typecheck
npm test
```

## Getting a Metrolinx API key

Register at the [Metrolinx Open Data API registration form](https://api.openmetrolinx.com/OpenDataAPI/Help/Registration/en). It's free, but approval is manual and can take up to 10 business days.

Once approved, place the key in a local `.env` file (copy `.env.example` and
fill in `METROLINX_API_KEY`).

You only need a key for two things: `npm run test:smoke` and
`scripts/capture-fixtures.ts`. The default `npm test` and all PR CI run
keyless, against static captured fixtures — you don't need a key to
contribute code or get a green PR.

## Verifying against Claude Desktop

Claude Desktop talks to the server over stdio. Two config forms, depending on
whether you're running from source or against a build:

**Dev (`tsx`, no build step):**

```json
{
  "mcpServers": {
    "go-transit": {
      "command": "npx",
      "args": ["tsx", "src/entry/stdio.ts"],
      "env": {
        "METROLINX_API_KEY": "your_key_here"
      }
    }
  }
}
```

**Built:**

```json
{
  "mcpServers": {
    "go-transit": {
      "command": "node",
      "args": ["dist/entry/stdio.js"],
      "env": {
        "METROLINX_API_KEY": "your_key_here"
      }
    }
  }
}
```

For the built form, run `npm run build` first so `dist/` exists.

### Tier 1 — MCP Inspector (per-change workhorse)

Run before every PR that touches tool behavior:

```bash
npm run build
npm run mcp-inspector
```

Then in the Inspector, connect over stdio to `node dist/entry/stdio.js` and
check:

- [ ] Server launches over stdio without errors
- [ ] All 17 tools are listed, each with its input/output schema
- [ ] All 4 resources are readable
- [ ] All 3 prompts render
- [ ] One happy-path call per tool group succeeds and returns
      `structuredContent`
- [ ] One error-taxonomy case: an unknown stop code returns an in-result
      `not_found` error, not a protocol error

### Tier 2 — Claude Desktop proper (release-time only)

A fuller manual pass before cutting a release:

- [ ] The config above installs cleanly and the server appears in Claude
      Desktop
- [ ] A `plan_trip` round-trip works in a real conversation (e.g. "Union to
      Oakville tomorrow at 8")
- [ ] The disambiguation flow works for an ambiguous stop name (e.g. "union
      to oakville")
- [ ] An error (e.g. a bad stop code) surfaces gracefully in-conversation,
      not as a broken tool call
