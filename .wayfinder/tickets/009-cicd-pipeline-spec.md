---
id: "009"
title: "Grilling: CI/CD Pipeline Spec"
type: grilling
status: resolved
assignee: emil
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

## Answer

Grilled 2026-07-17. Full spec: [docs/spec/cicd-pipeline.md](../../docs/spec/cicd-pipeline.md). Worked ahead of ticket 002's remaining wiring with two recorded assumptions (Vercel↔GitHub integration wired; `METROLINX_API_KEY` repo secret set — owner committed to both). Five decisions, all confirmed one-by-one:

1. **PR checks**: one `ci.yml` / one sequential `checks` job (`npm ci` → lint → format:check → typecheck → test+coverage), Node **[20, 22] matrix both required**, `setup-node` npm caching. Keyless by design — fork PRs get identical green checks.
2. **Deployment = Vercel built-in Git integration, zero deploy code**: auto previews per PR, auto production on push to `main`; gating happens at merge via branch protection. `VERCEL_*` secrets intentionally absent.
3. **Smoke ops**: cron `17 11 * * 1` (Monday-morning Toronto service peak, off-hour minute), job-level env injection of the repo secret, failure issue via transparent `gh` CLI steps (no marketplace action in the secret-holding workflow), `timeout-minutes: 10` + concurrency guard.
4. **Secrets inventory = `METROLINX_API_KEY` only**; CONTRIBUTING.md documents key registration (free, up to 10 business days) and that only `test:smoke` + fixture capture need it.
5. **Branch protection**: required checks `checks (20)`/`checks (22)`, no required reviews (solo), up-to-date off, **squash-merge only** + auto-delete branches; admin bypass allowed during planning, **flipped off the moment the code scaffold lands** (closes the unchecked-hot-push-deploys hole).
