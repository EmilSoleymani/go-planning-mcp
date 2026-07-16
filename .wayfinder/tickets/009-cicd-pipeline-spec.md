---
id: "009"
title: "Grilling: CI/CD Pipeline Spec"
type: grilling
status: open
blocked_by: ["002", "008", "003"]
blocks: []
---

## Question

Design the full GitHub Actions CI/CD pipeline:

**PR workflow** (triggers on every pull request)
- Jobs: lint → typecheck → unit tests (in parallel or sequential?)
- Node.js version matrix (single version or multiple?)
- Caching strategy for `node_modules`
- Vercel preview deployment — auto-deploy to a preview URL on every PR

**Merge to main workflow**
- Same checks as PR, then deploy to Vercel production
- Should deployment be gated on all checks passing?

**Weekly smoke test workflow**
- Schedule (cron expression)
- How is `METROLINX_API_KEY` secret injected?
- Failure notification — GitHub Actions default email, or Slack/other?
- Should smoke test results be posted as a GitHub issue on failure?

**Secrets to document**
- `METROLINX_API_KEY` — how contributors get their own key (link to registration)
- `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` — for deploy step

**Branch protection rules to recommend**
- Require PR reviews? (1 reviewer?)
- Require status checks to pass before merge?
- Require branches to be up to date?
