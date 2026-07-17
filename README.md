# go-planning-mcp

An MCP server that wraps the Metrolinx GO Transit Open Data API, letting LLMs plan trips, check schedules, and query live departures through natural conversation. Self-hostable via Docker or deployable to Vercel in minutes.

## Getting Started

> Work in progress — implementation coming soon.

## Running your own server

Transport split: **Claude Desktop → stdio; everything else → Streamable HTTP.**

### 1. Get a Metrolinx API key

Register at the [Metrolinx Open Data API registration form](https://api.openmetrolinx.com/OpenDataAPI/Help/Registration/en). It's free, but approval is manual and can take up to 10 business days.

### 2. `docker run` one-liner

```bash
docker run -e METROLINX_API_KEY=xxx -p 3000:3000 ghcr.io/emilsoleymani/go-planning-mcp
```

This serves the MCP endpoint at `http://localhost:3000/mcp` and a liveness probe at `http://localhost:3000/health`.

### 3. Compose quick start

```bash
git clone https://github.com/EmilSoleymani/go-planning-mcp.git
cd go-planning-mcp
cp .env.example .env  # then add your METROLINX_API_KEY
docker compose up
```

### 4. Claude Desktop (stdio)

```json
{
  "mcpServers": {
    "go-transit": {
      "command": "npx",
      "args": ["go-transit-mcp"],
      "env": {
        "METROLINX_API_KEY": "your_key_here"
      }
    }
  }
}
```

From source (contributor/dev variant):

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

## License

MIT
