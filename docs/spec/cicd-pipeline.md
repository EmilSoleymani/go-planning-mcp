# CI/CD Pipeline Specification

Resolved by [ticket 009](../../.wayfinder/tickets/009-cicd-pipeline-spec.md) (grilled 2026-07-17). Builds on the test architecture (ticket 008), Vercel constraints (ticket 003), and project architecture (ticket 007). Public repo → Actions minutes are free; parallelism costs nothing but wall clock.

**Assumptions on the repo task (ticket 002)**: the Vercel↔GitHub integration is wired for this repo, and the `METROLINX_API_KEY` repo secret is set. This spec depends on both.

## 1. PR checks — `.github/workflows/ci.yml`

- **Triggers**: `pull_request`, plus `push` to `main`.
- **One `checks` job**, sequential steps: `npm ci` → `lint` → `format:check` → `typecheck` → `test` (Vitest with the 80/70 coverage gate). One install, one log, one job definition. Parallel jobs were ruled out: three checkouts/installs to save ~a minute on a suite this small.
- **Node matrix: [20, 22], both required** — tests the promised `engines >= 20` floor and the current line; catches "works on my Node" drift for self-hosters.
- **Caching**: `actions/setup-node` with `cache: 'npm'` (npm cache keyed on `package-lock.json`). No `node_modules` caching — fragile across matrix entries, negligible win over a warm npm cache.
- **Keyless by design**: no secret is available to or needed by this workflow (ticket 008). Fork PRs get identical green checks. A comment in the YAML states this so nobody "fixes" it later.

## 2. Deployment — Vercel built-in Git integration, zero deploy code

- **Previews**: every PR gets an automatic preview URL (confirmed working on Hobby for personal repos, ticket 003).
- **Production**: every push to `main` auto-deploys.
- **Gating happens at the merge, not the deploy**: branch protection (§5) requires green checks before anything reaches `main`, so deploy-on-push is by construction deploy-what-passed-CI. Caveat and its closure: this invariant binds only when admin bypass is off — see the phase-two rule in §5.
- **No `VERCEL_TOKEN` / `VERCEL_ORG_ID` / `VERCEL_PROJECT_ID` secrets** — intentionally absent; the integration replaces CLI deploys, token rotation, and preview-URL comment plumbing. Revisit only if sequenced deploy logic (e.g. deploy-after-smoke) is ever required.

## 3. Weekly smoke — `.github/workflows/smoke.yml`

Contract from ticket 008: separate file, weekly + `workflow_dispatch`, never PR-gating, schema-validation pass criterion, idempotent auto-issue on failure. Operational details:

- **Cron: `17 11 * * 1`** — Mondays 11:17 UTC ≈ 6:17/7:17 a.m. Toronto: Monday-morning service peak gives real-time endpoints rich data; the off-hour minute avoids GitHub's congested top-of-hour cron slots.
- **Secret injection**: job-level `env: METROLINX_API_KEY: ${{ secrets.METROLINX_API_KEY }}`. No environments/OIDC — one read-only key.
- **Failure → issue via `gh` CLI steps** (built-in `GITHUB_TOKEN`), not a marketplace action — smaller supply-chain surface in the one workflow holding a real secret:
  1. On failure, search open issues labeled `smoke-failure`.
  2. If one exists, comment with the new run's failing tools + run link; else create it (failing-tool summary from Vitest's JSON reporter).
- **Housekeeping**: `timeout-minutes: 10`; `concurrency` group so a manual dispatch can't overlap the scheduled run.
- Runs `npm run test:smoke` only.

## 4. Secrets & contributor documentation

- **Full secret inventory: `METROLINX_API_KEY`** (repo secret; owner-set). That's the list.
- **CONTRIBUTING.md — "Getting a Metrolinx API key"**: registration-form link, expectations (free, manual approval, up to 10 business days), local placement (`.env` per `.env.example`), and the note that the key is only needed for `test:smoke` and `scripts/capture-fixtures.ts` — default `test` and all PR CI run keyless.

## 5. Branch protection & merge strategy

- **Required status checks**: `checks (20)` and `checks (22)`. No required reviewers (solo maintainer — a review requirement is self-lockout). "Require branch up to date": **off** (squash merges + low traffic → pure re-run friction).
- **Squash-merge only**; merge commits and rebase merging disabled; auto-delete head branches. Linear history, one commit per PR, PR title = commit message.
- **Admin enforcement, two phases**:
  - *Now (planning/bootstrap)*: admin bypass allowed — direct-to-`main` planning-doc commits are the working pattern of the wayfinder sessions.
  - **The moment the code scaffold lands: flip "do not allow bypass" on.** This closes the §2 hole (owner hot-push deploying unchecked code to production). This flip is an explicit implementation-phase checklist item, not a memory.
