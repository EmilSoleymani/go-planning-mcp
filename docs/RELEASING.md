# Releasing

This project publishes to **ghcr.io** (multi-arch Docker image) and **npm**
(`go-transit-mcp`) on every `v*` git tag, per
[docs/spec/docker-deployment.md §5–§6](spec/docker-deployment.md). Pushing to
`main` never publishes anything — only a tag does.

This doc has two parts: a **one-time setup checklist** (do this once, before
the first release) and a **per-release runbook** (do this every time).

## One-time setup

Do these once, before running a release for the first time.

- [ ] **npm account.** Have an npm account with publish rights, and confirm
      the `go-transit-mcp` package name is still unclaimed (or already owned
      by this account, if a previous release created it).
- [ ] **npm trusted publisher binding.** On the `go-transit-mcp` package's
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
      the README works for anyone without a `docker login`.
- [ ] **ghcr workflow permissions.** Confirm the repo's Actions settings
      allow workflows to write packages (Settings → Actions → General →
      Workflow permissions → "Read and write permissions"), or the
      job-level `permissions: packages: write` in `release.yml` won't be
      enough on its own.
- [ ] **Branch protection: flip on admin enforcement.** Per
      [docs/spec/cicd-pipeline.md §5](spec/cicd-pipeline.md), once the code
      scaffold has landed, turn off "Allow bypassing the above settings" for
      admins on the `main` branch protection rule, so a release can never
      ship code that skipped CI.

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
2. **Cut the version.** From a clean, up-to-date local `main`:

   ```bash
   npm version <patch|minor|major>
   git push --follow-tags
   ```

   `npm version` bumps `package.json`, commits it, and creates the matching
   `vX.Y.Z` tag; `--follow-tags` pushes both the commit and the tag.

3. **Watch the workflow.** The tag push triggers `.github/workflows/release.yml`.
   Watch it in the Actions tab:
   - `checks` (both Node 20 and 22) must pass before either publish job
     starts.
   - `publish-ghcr` builds and pushes the multi-arch image with the semver
     tag cascade (`X.Y.Z`, `X.Y`, `X`) plus `latest`.
   - `publish-npm` builds and runs `npm publish --provenance` via trusted
     publishing.
4. **Verify the artifacts** once both publish jobs are green:

   ```bash
   npx go-transit-mcp@latest
   docker run -e METROLINX_API_KEY=xxx -p 3000:3000 ghcr.io/emilsoleymani/go-planning-mcp:latest
   ```

   Confirm the npm package page shows the new version with a provenance
   badge, and that the ghcr package page lists the new semver tags.

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
