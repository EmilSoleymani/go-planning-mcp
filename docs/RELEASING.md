# Releasing

This project publishes to **ghcr.io** (multi-arch Docker image) and **npm**
(`go-transit-mcp`) on every `v*` git tag, per
[docs/spec/docker-deployment.md §5–§6](spec/docker-deployment.md). Pushing to
`main` never publishes anything — only a tag does.

This doc has two parts: a **one-time setup checklist** (do this once, before
the first release) and a **per-release runbook** (do this every time).

## One-time setup

Do these once, before running a release for the first time.

- [x] **npm account.** Have an npm account with publish rights, and confirm
      the `go-transit-mcp` package name is still unclaimed (or already owned
      by this account, if a previous release created it). Note: an
      unattested `0.0.0` already exists on the registry from a manual
      `npm publish` predating the trusted-publisher binding below — this
      doesn't block anything (`npm version` moves past it), but it means the
      first CI-published version won't be `0.0.0`.
- [x] **npm trusted publisher binding.** On the `go-transit-mcp` package's
      npm settings page (or, for a first publish, when creating the package),
      add a trusted publisher pointing at this GitHub repository and the
      `.github/workflows/release.yml` workflow file. This is what lets
      `publish-npm` authenticate via GitHub Actions OIDC with no `NPM_TOKEN`
      secret. Without this step, `npm publish --provenance` in the workflow
      will fail with an auth error.
- [ ] **ghcr package visibility.** After the first successful `publish-ghcr`
      run, the `go-planning-mcp` package will exist under the repo owner's
      GitHub Packages but may default to private. Set it to **public** (
      Package settings → Change visibility) so the `docker run` one-liner in
      the README works for anyone without a `docker login`. Not yet
      applicable — no tag has been pushed, so the package doesn't exist yet.
- [x] **ghcr workflow permissions.** Confirm the repo's Actions settings
      allow workflows to write packages (Settings → Actions → General →
      Workflow permissions → "Read and write permissions"), or the
      job-level `permissions: packages: write` in `release.yml` won't be
      enough on its own.
- [x] **Branch protection: flip on admin enforcement.** Per
      [docs/spec/cicd-pipeline.md §5](spec/cicd-pipeline.md), once the code
      scaffold has landed, turn off admin bypass so a release can never ship
      code that skipped CI. Implemented as repository ruleset `protect-main`
      (Settings → Rules → Rulesets, not the classic branch protection page):
      requires `checks (20)` + `checks (22)`, squash-only merge, and an empty
      bypass list (`current_user_can_bypass: never`).

Nothing above is automated by this repo — they're one-time actions to take
by hand in the GitHub/npm UI.

## Per-release runbook

1. **Preflight.**
   - [ ] `main` is green: the latest `checks` run on `main` passed.
   - [ ] The most recent weekly smoke run (`smoke.yml`) is green, or any
         open `smoke-failure` issue is understood and not a blocker for this
         release.
   - [ ] A Tier 1 MCP Inspector pass (per `CONTRIBUTING.md`) has been run
         against a local build recently.
2. **Bump the version on a branch, land it via PR.** `npm version` normally
   commits *and* tags in one step, then expects `git push --follow-tags` to
   push both straight to `main` — but `protect-main` requires every change
   to `main` go through a PR with green checks, with no bypass for anyone.
   A direct push of the version-bump commit will be rejected. Split the
   steps instead so the tag never gets created before the bump is actually
   on `main`:

   ```bash
   git checkout -b chore/release-vX.Y.Z
   npm version <patch|minor|major> --no-git-tag-version
   git commit -am "vX.Y.Z"
   git push -u origin chore/release-vX.Y.Z
   gh pr create --fill
   ```

   `--no-git-tag-version` bumps `package.json`/`package-lock.json` only —
   no commit, no tag — so there's nothing to accidentally tag before it's
   merged. Wait for `checks` to pass, then merge (squash).

3. **Tag the merged commit.** From a clean, up-to-date local `main`:

   ```bash
   git checkout main && git pull --ff-only
   git tag vX.Y.Z
   git push origin vX.Y.Z
   ```

   Tags aren't covered by `protect-main` (it only restricts
   `refs/heads/main`), so this push needs no PR. Tagging *after* the merge —
   rather than locally before it, the way `npm version` does by default —
   guarantees the tag points at a commit `main` actually contains, instead
   of an orphaned commit that only exists on the tag.

4. **Watch the workflow.** The tag push triggers `.github/workflows/release.yml`.
   Watch it in the Actions tab:
   - `checks` (both Node 20 and 22) must pass before either publish job
     starts.
   - `publish-ghcr` builds and pushes the multi-arch image with the semver
     tag cascade (`X.Y.Z`, `X.Y`, `X`) plus `latest`.
   - `publish-npm` builds and runs `npm publish --provenance` via trusted
     publishing.
5. **Verify the artifacts** once both publish jobs are green:

   ```bash
   npx go-transit-mcp@latest
   docker run -e METROLINX_API_KEY=xxx -p 3000:3000 ghcr.io/emilsoleymani/go-planning-mcp:latest
   ```

   Confirm the npm package page shows the new version with a provenance
   badge, and that the ghcr package page lists the new semver tags.

6. **Create the GitHub Release.** Not part of the ghcr/npm publish pipeline
   and doesn't trigger anything — purely a changelog page for the tag:

   ```bash
   gh release create vX.Y.Z --title "vX.Y.Z" --generate-notes
   ```

## Recovery: a publish half-fails

Because `publish-ghcr` and `publish-npm` are independent jobs (both gated on
the same `checks` job, but not on each other), it's possible for one to
succeed and the other to fail — e.g. ghcr publishes fine but npm rejects the
publish because the trusted publisher binding drifted.

- **Don't re-tag.** The `vX.Y.Z` tag and its `checks` run already succeeded;
  re-running `npm version` would create a duplicate/conflicting tag.
- **Re-run only the failed job** from the Actions UI ("Re-run failed jobs"
  on the `release.yml` run for that tag). Both publish jobs are idempotent
  against the same tag/version: re-pushing the same ghcr tags overwrites
  them with the same content, and `npm publish` for a version that's
  already on the registry simply fails harmlessly (npm does not allow
  republishing an existing version).
- If the failure is a config problem (e.g. the npm trusted publisher binding
  isn't set up yet), fix the one-time setup item above, then re-run the
  failed job — no need to touch git at all.

## Recovery: the old one-shot `npm version && git push --follow-tags` was used by mistake

If step 2's PR-first flow gets skipped and `npm version` is run and pushed
the old way, `git push --follow-tags` will push the tag (tags aren't gated
by `protect-main`) but get the branch push rejected — so the tag ends up
pointing at a commit that was never merged into `main`, and the tag push
alone is enough to trigger `release.yml` and publish for real.

- **Let the triggered release run finish** — it's publishing a real,
  correctly-built version; cancelling it doesn't undo whatever already
  succeeded (npm in particular does not allow republishing a version once
  it's live) and just leaves things half-done instead.
- **Don't re-tag or re-run `npm version`.** The tag already exists and
  already triggered a build against the right code.
- **Reconcile `main` after the fact**: push the orphaned version-bump commit
  to a new branch and open a normal PR into `main`, same as step 2. Once
  merged, `main`'s `package.json` matches what's already published — the
  tag doesn't need to move, since it already points at the (now also
  on-`main`) commit's content.
