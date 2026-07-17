---
id: "002"
title: "Task: Create GitHub Repository"
type: task
status: resolved
assignee: emil
blocked_by: []
blocks: ["009"]
---

## Question

The repo `go-planning-mcp` needs to exist as a public GitHub repository before CI/CD, Vercel integration, and contributor workflows can be specced. What needs to happen:

- Create public GitHub repo (name: `go-planning-mcp`, under the user's account)
- Push initial commit: `LICENSE` (MIT), `README.md` (placeholder), `.gitignore` (Node.js)
- Configure default branch as `main`
- Enable GitHub Actions (on by default for public repos)
- Wire up Vercel: connect repo in Vercel dashboard, configure `METROLINX_API_KEY` as an environment secret

**This is a HITL task** — the user must create the repo and connect Vercel. Provide a precise checklist for the user to follow.

Record the resulting repo URL and Vercel project URL as the resolution so downstream tickets can reference them.

## Answer

Completed 2026-07-17. Resulting facts downstream work depends on:

- **GitHub repo**: https://github.com/EmilSoleymani/go-planning-mcp — public, default branch `main`, Actions enabled, MIT `LICENSE` committed, Node `.gitignore` (`.env` verified ignored and untracked).
- **GitHub Actions repo secret**: `METROLINX_API_KEY` set by owner (2026-07-17) — the smoke workflow (ticket 009) can assume it.
- **Vercel project**: https://vercel.com/emilsoleymani2002-gmailcoms-projects/go-planning-mcp — repo imported via the Vercel GitHub integration (framework preset "Other").
- **Production domain**: https://go-planning-mcp.vercel.app/
- Deploys are no-ops until the code scaffold (`api/mcp.ts`) lands — expected and harmless.
- **Open verification carried to implementation**: confirm `METROLINX_API_KEY` is set as a Vercel project environment variable for **Production and Preview** (separate from the GitHub secret; required for functions and PR previews to reach the Metrolinx API). Trivially checked when the first real deploy happens.
- Per the CI/CD spec, **no `VERCEL_TOKEN`/`VERCEL_ORG_ID`/`VERCEL_PROJECT_ID` secrets exist or are needed** (built-in Git integration).
