---
id: "002"
title: "Task: Create GitHub Repository"
type: task
status: open
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
