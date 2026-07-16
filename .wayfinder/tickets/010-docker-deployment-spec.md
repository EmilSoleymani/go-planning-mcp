---
id: "010"
title: "Grilling: Docker & Deployment Spec"
type: grilling
status: open
blocked_by: ["007"]
blocks: []
---

## Question

Spec the container and local development experience:

**Dockerfile**
- Multi-stage build: build stage (full Node + TypeScript) → runtime stage (Node slim/alpine)?
- Which Node.js base image version and variant?
- What's the container entrypoint — `http.ts` (Streamable HTTP server)?
- What port does the container expose?
- How is `METROLINX_API_KEY` documented for the `docker run` command?

**docker-compose.yml**
- What does local development look like? (`docker compose up` starts the HTTP server?)
- Should the compose file also include a watch mode with hot reload?
- Environment variable handling — `.env` file pattern?

**Self-hoster documentation**
- `docker run` one-liner with env var
- `docker compose` quick start
- Claude Desktop `claude_desktop_config.json` snippet for stdio mode
- Health check endpoint — should the HTTP server expose `GET /health`?

**Image publishing**
- Should the project publish a Docker image to GitHub Container Registry (ghcr.io)?
- If yes, which CI event triggers a publish (merge to main? tagged release?)
- Image tagging strategy: `latest` + semver tags?
