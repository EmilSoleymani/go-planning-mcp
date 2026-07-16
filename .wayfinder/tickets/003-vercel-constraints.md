---
id: "003"
title: "Research: Vercel Free Tier Constraints"
type: research
status: open
blocked_by: []
blocks: ["009"]
---

## Question

Document the Vercel Hobby (free) tier constraints that affect this MCP server:

- Serverless function execution timeout (default and max)
- Maximum request/response body size
- Invocation limits per month
- Cold start behaviour — typical latency on Node.js runtimes
- Whether Streamable HTTP (chunked transfer / long-polling) works within function timeout limits
- Edge Runtime vs Node.js Runtime — which is available on free tier and which suits an MCP server?
- Preview deployment behaviour for PRs — does it work on free tier?
- Any bandwidth limits relevant to transit API response sizes

Conclude with: are there any Vercel free tier constraints that would force a design change, or is the plan viable as stated?
