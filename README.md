# go-planning-mcp

[![Release](https://github.com/EmilSoleymani/go-planning-mcp/actions/workflows/release.yml/badge.svg)](https://github.com/EmilSoleymani/go-planning-mcp/actions/workflows/release.yml)
[![Smoke](https://github.com/EmilSoleymani/go-planning-mcp/actions/workflows/smoke.yml/badge.svg)](https://github.com/EmilSoleymani/go-planning-mcp/actions/workflows/smoke.yml)

An MCP server that wraps the Metrolinx GO Transit Open Data API, letting LLMs plan trips, check schedules, and query live departures through natural conversation. Self-hostable via Docker or deployable to Vercel in minutes.

## Tools

17 tools, normalized to consistent `snake_case` DTOs (never a passthrough of Metrolinx's raw shapes). Full parameter tables and example output for every tool live in [docs/TOOLS.md](docs/TOOLS.md).

| Tool | Description |
|---|---|
| **Trip planning** | |
| [`plan_trip`](docs/TOOLS.md#plan_trip) | Plan a trip by station/stop name (fuzzy-resolved) or code; composes cross-line transfers via Union automatically. |
| [`plan_journey`](docs/TOOLS.md#plan_journey) | Fine-control trip planner for exact stop codes — no fuzzy resolution, no transfer composition. |
| **Stops** | |
| [`search_stops`](docs/TOOLS.md#search_stops) | Fuzzy search for stops/stations by name fragment. |
| [`get_stop_details`](docs/TOOLS.md#get_stop_details) | Location, service modes, facilities, parking, and accessibility for one stop. |
| [`get_next_service`](docs/TOOLS.md#get_next_service) | Live upcoming departures for one stop. |
| [`get_stop_destinations`](docs/TOOLS.md#get_stop_destinations) | Where a stop's services go within a time window. |
| **Schedules & lines** | |
| [`list_lines`](docs/TOOLS.md#list_lines) | GO Transit's line roster for a service day, with valid direction codes. |
| [`get_line_schedule`](docs/TOOLS.md#get_line_schedule) | A line's published schedule for a service day (trip summaries, or times at one stop). |
| [`get_trip_status`](docs/TOOLS.md#get_trip_status) | Live stop-by-stop status for a single trip. |
| **Service updates** | |
| [`get_service_alerts`](docs/TOOLS.md#get_service_alerts) | Folded service/information/marketing alerts. |
| [`get_service_exceptions`](docs/TOOLS.md#get_service_exceptions) | Today's cancelled trips and stops. |
| [`get_service_guarantee`](docs/TOOLS.md#get_service_guarantee) | Service guarantee eligibility for a past trip. |
| [`get_union_departures`](docs/TOOLS.md#get_union_departures) | Live Union Station departure board. |
| **Fares & fleet** | |
| [`get_fares`](docs/TOOLS.md#get_fares) | Fare rows between two stops, flattened by rider type and payment method. |
| [`get_fleet_consist`](docs/TOOLS.md#get_fleet_consist) | The physical car makeup of a train, by trip or engine number. |
| **Real-time (GTFS-RT)** | |
| [`get_vehicle_positions`](docs/TOOLS.md#get_vehicle_positions) | Live positions, delay, and occupancy for vehicles of one mode. |
| [`get_trip_updates`](docs/TOOLS.md#get_trip_updates) | What's off-plan right now — delays and cancellations. |

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
