# go-planning-mcp

An MCP server that wraps the Metrolinx GO Transit Open Data API, letting LLMs plan trips, check schedules, and query live departures through natural conversation. Self-hostable via Docker or deployable to Vercel in minutes.

## Getting Started

> Work in progress — implementation coming soon.

## Usage

Set your Metrolinx API key:

```bash
export METROLINX_API_KEY=your_key_here
```

### Claude Desktop (stdio)

```json
{
  "mcpServers": {
    "go-transit": {
      "command": "node",
      "args": ["dist/stdio.js"],
      "env": {
        "METROLINX_API_KEY": "your_key_here"
      }
    }
  }
}
```

### Docker (HTTP)

```bash
docker run -p 3000:3000 -e METROLINX_API_KEY=your_key_here ghcr.io/emilsoleymani/go-planning-mcp
```

## License

MIT
