# Research Report — Ticket 003: Vercel Hobby (Free) Tier Constraints

**Date:** 2026-07-16
**Sources:** Vercel official docs (`vercel.com/docs`), Vercel official blog/changelog, npm registry API, `vercel/mcp-handler` GitHub README. All doc pages cited were last updated between 2026-02 and 2026-07 per their published frontmatter. No third-party write-ups were used.

## Summary

**Verdict: the plan is viable on the Vercel Hobby tier as stated — no design change is forced.** Deploy the Streamable HTTP transport as a Node.js-runtime Vercel Function with Fluid compute (the default for new projects). Key confirmations:

- **Timeout is generous:** 300 s (5 min) default *and* maximum on Hobby with Fluid compute — far more than any single MCP request/response cycle needs. ([functions/limitations](https://vercel.com/docs/functions/limitations))
- **Streamable HTTP fits the model:** each MCP client→server POST is one function invocation; Vercel officially supports and documents exactly this pattern via its `mcp-handler` package (the renamed `@vercel/mcp-adapter`). Redis is only needed for the *legacy SSE* transport, not Streamable HTTP. ([docs/mcp/deploy-mcp-servers-to-vercel](https://vercel.com/docs/mcp/deploy-mcp-servers-to-vercel), [mcp-handler README](https://github.com/vercel/mcp-handler))
- **Node.js runtime is the default and the right choice**; Vercel itself now recommends migrating *away* from the Edge runtime ("We recommend migrating from edge to Node.js for improved performance and reliability" — [runtimes/edge](https://vercel.com/docs/functions/runtimes/edge)). The MCP SDK's Node API requirements are a non-issue.
- **Payload sizes are fine:** 4.5 MB request/response body limit, and streamed responses are explicitly exempt from the response half of that limit. Hundreds-of-KB Metrolinx payloads are two orders of magnitude below the cap.
- **Quotas are ample for a personal project:** 1 M invocations, 4 active-CPU-hours, 360 GB-hrs provisioned memory, 100 GB Fast Data Transfer per month. When exceeded, the feature pauses (no surprise bills) until the 30-day window rolls over.
- **PR previews work on Hobby** for personal-account repos; they do **not** work for private repos owned by a GitHub organization (the repo per ticket 002 will be a public personal repo, so this is moot).

Two caveats worth carrying into downstream tickets (005, 007, 009, 010), neither blocking:

1. **Hobby is licensed for non-commercial personal use only** per Vercel's fair-use guidelines — fine for this project as scoped, but a constraint to note in the spec.
2. **Long-lived server→client streams (the optional Streamable HTTP GET/SSE channel) are bounded by the 300 s max duration**, and "scale to one" warm instances are documented only for Pro/Enterprise — so the design should treat the server as **stateless per-request** (which the `mcp-handler`/serverless pattern already assumes) and not rely on persistent sessions or server-initiated notifications. The Metrolinx API is poll-only anyway (ticket 001), so nothing needs push.

---

## 1. Serverless function execution timeout

With **Fluid compute** (enabled by default for all new projects since April 23, 2025):

| Plan | Default | Maximum |
|---|---|---|
| Hobby | **300 s (5 min)** | **300 s (5 min)** |
| Pro/Enterprise | 300 s | 800 s (1800 s extended, beta) |

Source: [vercel.com/docs/functions/limitations#max-duration](https://vercel.com/docs/functions/limitations) and [vercel.com/docs/functions/configuring-functions/duration](https://vercel.com/docs/functions/configuring-functions/duration).

- The duration clock covers the whole invocation: "For request handlers, this includes time spent processing the request and sending the response, **including streamed responses**." Exceeding it returns `504 FUNCTION_INVOCATION_TIMEOUT`. ([limitations](https://vercel.com/docs/functions/limitations))
- Legacy note: projects deployed **before** April 23, 2025 *without* Fluid compute had Hobby limits of 10 s default / 60 s max ([docs/limits](https://vercel.com/docs/limits)). This project will be a new project, so the 300 s Fluid numbers apply — but the spec should pin `fluid: true` semantics explicitly (it is the default; no action needed beyond not disabling it).
- `maxDuration` is configured per-function via `export const config = { maxDuration: … }` or in `vercel.json` under `functions.<path>.maxDuration`. ([configuring duration](https://vercel.com/docs/functions/configuring-functions/duration))

**Implication:** a typical MCP tool call (one Metrolinx API round-trip plus formatting) completes in single-digit seconds. 300 s is not a constraint.

## 2. Maximum request/response body size

- "The maximum payload size for the request body or the response body of a Vercel Function is **4.5 MB**." Exceeding it returns `413 FUNCTION_PAYLOAD_TOO_LARGE`. ([functions/limitations#request-body-size](https://vercel.com/docs/functions/limitations))
- **Streamed responses are exempt from the response-side limit.** Vercel's own KB guide on the limit points to "streaming functions, which don't have this limit" as the workaround for large responses. ([kb: how to bypass the 4.5 MB body size limit](https://vercel.com/kb/guide/how-to-bypass-vercel-body-size-limit-serverless-functions))
- The *request* body limit (4.5 MB) still applies, but MCP JSON-RPC requests are tiny.

**Implication:** even a buffered (non-streamed) JSON response containing a full journey plan or GTFS-RT snapshot (hundreds of KB) is ~10× under the limit; streamed responses have no size cap at all.

## 3. Invocation and compute limits per month (Hobby)

From [vercel.com/docs/limits#usage-summary](https://vercel.com/docs/limits) and [vercel.com/docs/plans/hobby](https://vercel.com/docs/plans/hobby):

| Resource | Hobby included / month |
|---|---|
| Function invocations | **1,000,000** |
| Active CPU | **4 CPU-hrs** |
| Provisioned memory | **360 GB-hrs** |
| Edge requests | up to 1,000,000 |
| Fast Data Transfer | 100 GB |
| Fast Origin Transfer | up to 10 GB |

- **Overage behaviour:** "As the Hobby plan is a free tier there are no billing cycles. In most cases, if you exceed your usage limits on the Hobby plan, you will have to wait until 30 days have passed before you can use the feature again." — i.e. the feature pauses; there is no automatic charge. ([plans/hobby](https://vercel.com/docs/plans/hobby))
- **Licence constraint:** "the Hobby plan restricts users to non-commercial, personal use only" per the fair-use guidelines. ([plans/hobby](https://vercel.com/docs/plans/hobby), [fair use](https://vercel.com/docs/limits/fair-use-guidelines))
- Other Hobby platform limits that could matter operationally: 100 deployments/day, 200 projects, memory fixed at 2 GB / 1 vCPU (default = max on Hobby), function bundle ≤ 250 MB uncompressed, 1,024 file descriptors shared across concurrent executions. ([docs/limits](https://vercel.com/docs/limits), [functions/limitations](https://vercel.com/docs/functions/limitations))

**Implication:** the binding constraint for a busy MCP server is more likely **4 active-CPU-hours/month** than the 1 M invocations. Active CPU counts only time the code is actually executing (I/O wait — e.g. waiting on Metrolinx — is free). A JSON-transform workload spending ~50 ms of actual CPU per call still affords ~288k calls/month. Fine for personal use; caching (ticket 005) stretches it further.

## 4. Cold start behaviour on Node.js

What the primary sources actually say:

- Fluid compute provides "**automatic cold start optimizations**: reduces the effects of cold starts through automatic bytecode optimization, and function pre-warming on production deployments." ([docs/fluid-compute](https://vercel.com/docs/fluid-compute))
- **Bytecode caching** (Node.js 20+) stores compiled bytecode after first execution; "the first request isn't cached yet" and it is "only applied to production environments, and is not available in development or preview deployments." ([docs/fluid-compute#bytecode-caching](https://vercel.com/docs/fluid-compute))
- Vercel's blog ["Scale to one: How Fluid solves cold starts"](https://vercel.com/blog/scale-to-one-how-fluid-solves-cold-starts) (2025-09-18) claims "zero cold starts for 99.37% of all requests" platform-wide, and that "pre-warming prevents a third of potential cold starts." It describes **scale-to-one** (keeping one instance warm instead of scaling to zero) for **current production deployments on Pro and Enterprise**; the Hobby plan is not listed as eligible for scale-to-one. The docs page does not restrict pre-warming by plan; the blog scopes scale-to-one to paid tiers. Treat "Hobby gets pre-warming + bytecode caching but not guaranteed scale-to-one" as the safest reading.
- **The docs publish no typical cold-start latency number for the Node.js runtime.** The KB guide ([how can I improve function cold start performance](https://vercel.com/kb/guide/how-can-i-improve-serverless-function-lambda-cold-start-performance-on-vercel)) gives only qualitative guidance: "Startup times are correlated to function size, which is often mostly from external dependencies. If you have large dependencies, parsing and evaluating JavaScript code can take seconds or longer." Its blog cites a 3–4 s worst case for a heavy traditional-serverless page load, not a Node.js baseline. **Where docs are silent, we say so: no official ms figure exists.**

**Implication:** keep the deployed function's dependency graph small (the MCP SDK + zod + a fetch wrapper — no heavyweight deps), and cold starts on a 2 GB/1 vCPU Node instance should be modest. An occasional cold start adds latency to the first MCP `initialize` call; this is acceptable for a trip-planning assistant.

## 5. Streamable HTTP within the timeout limits

Yes — this works, and it is the deployment model Vercel itself documents:

- Vercel's official MCP guide deploys a Streamable HTTP MCP server as a function route (`app/api/mcp/route.ts` exporting `GET`/`POST`/`DELETE` handlers) and has MCP clients connect "in Streamable HTTP transport format." ([docs/mcp/deploy-mcp-servers-to-vercel](https://vercel.com/docs/mcp/deploy-mcp-servers-to-vercel))
- In Streamable HTTP, **each client→server JSON-RPC POST is an independent HTTP request**, i.e. one function invocation with its own 300 s budget. A tool call that streams its response over chunked transfer/SSE within that POST must finish within 300 s — ample.
- The duration limit explicitly *includes* streamed response time ([functions/limitations](https://vercel.com/docs/functions/limitations)), so the **optional long-lived GET stream** (the channel a Streamable HTTP server may keep open for unsolicited server→client notifications) is capped at 300 s per connection on Hobby. Clients reconnect per the MCP spec, but a design that *depends* on a persistent push channel would degrade. This project needs no push (Metrolinx is poll-only, ticket 001), so the constraint is irrelevant here — worth one line in the architecture spec (ticket 007).
- Vercel's changelog announcing MCP support ([2025-05-07](https://vercel.com/changelog/mcp-server-support-on-vercel)) notes the adapter supports "both legacy SSE and the newer stateless HTTP approach", and that **Redis (e.g. Upstash) is only suggested for SSE deployments requiring state** — the `mcp-handler` README likewise lists Redis as "optional, for SSE." Stateless Streamable HTTP needs no external store.

## 6. Edge Runtime vs Node.js Runtime

- **Node.js runtime is the default** and Vercel now actively steers users off Edge: "We recommend migrating from edge to Node.js for improved performance and reliability. Both runtimes run on Fluid compute with Active CPU pricing." ([docs/functions/runtimes/edge](https://vercel.com/docs/functions/runtimes/edge))
- Both runtimes are available on Hobby (the Edge page lists a Hobby code-size limit of 1 MB gzipped, confirming availability), but Edge exposes only a Web-API subset plus five Node compat modules (`async_hooks`, `events`, `buffer`, `assert`, `util`); "you can't read or write to the filesystem," `require` is disallowed, and "most libraries that use Node.js APIs as dependencies can't be used." ([runtimes/edge](https://vercel.com/docs/functions/runtimes/edge))
- The `@modelcontextprotocol/sdk` server-side transports use Node APIs (e.g. `node:crypto`, streams, `http` types), and Vercel's `mcp-handler` README states it requires **Node.js 18+**. ([mcp-handler README](https://github.com/vercel/mcp-handler))
- Fluid-compute limits doc confirms "Full Node.js coverage" for the Node runtime. ([functions/limitations#api-support](https://vercel.com/docs/functions/limitations))

**Decision input:** use the **Node.js runtime**. There is no reason to consider Edge, and Vercel's own guidance points the same way.

## 7. PR preview deployment behaviour on Hobby

- Preview deployments are core Git-integration behaviour on all plans: "Vercel allows for automatic deployments on every branch push", "Preview deployments for every push", and each PR gets a unique preview URL. ([docs/git](https://vercel.com/docs/git))
- **Hobby-specific limitations** (all from [docs/git](https://vercel.com/docs/git) and [docs/limits](https://vercel.com/docs/limits)):
  - "You cannot deploy to a Hobby team from a **private repository in a GitHub organization**, GitLab group, or Bitbucket workspace." Personal-account repos (public or private) are fine; org-owned repos require Pro. Also: "Vercel does not support connecting a project on your Hobby team to Git repositories owned by Git organizations."
  - On a Hobby team, "the commit author must be the owner of the Hobby team" for private-repo deploys; PRs from forks of a public repo require explicit authorization by the owner before deploying (a security measure on all plans).
  - Deployment rate limits: 100 deployments/day, 100 builds/hour, 1 concurrent build.
- **Deployment Protection:** "On the Hobby plan, Vercel Authentication with Standard Protection is available. This protects your preview deployments and deployment URLs, but your production domain remains publicly accessible." ([docs/deployment-protection](https://vercel.com/docs/deployment-protection)) If protection is enabled, an MCP client cannot hit a preview URL directly; **Protection Bypass for Automation** (a per-project secret sent as an `x-vercel-protection-bypass` header or query param, auto-exposed as `VERCEL_AUTOMATION_BYPASS_SECRET`) exists to let CI/E2E tooling through, and the docs page does not gate it to paid plans. ([protection-bypass-automation](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation)) The docs do not, however, publish an explicit "available on Hobby" statement for the bypass feature — flagged in Open Questions.
- Note for CI design (ticket 009): bytecode caching does **not** apply to preview deployments ([fluid-compute](https://vercel.com/docs/fluid-compute)), so previews will cold-start slightly slower than production. Cosmetic only.

## 8. Bandwidth limits vs Metrolinx response sizes

- Hobby includes **100 GB Fast Data Transfer** (edge↔client) and **up to 10 GB Fast Origin Transfer** (edge↔function) per month. ([docs/limits#usage-summary](https://vercel.com/docs/limits))
- Sizing sanity check: a worst-case ~500 KB MCP response consumes both fast-origin and fast-data transfer. The tighter budget, 10 GB origin transfer, allows ≈20,000 such maximal responses/month; typical responses (a few KB–tens of KB after the wrapper trims Metrolinx payloads) allow orders of magnitude more. Outbound calls *from* the function to `api.openmetrolinx.com` are ordinary internet egress from the function, not billed as Fast Data Transfer to clients; the docs do not enumerate a separate metered category for generic external fetches on Hobby (silent — see Open Questions).
- Design lever: the wrapper should **not** proxy raw GTFS-RT/journey payloads verbatim to MCP clients; trimming/normalizing responses (already implied by tickets 004/005) keeps both bandwidth and client-side token costs down.

## 9. Vercel-official MCP guidance and the adapter package

- **Docs:** [Deploy MCP servers to Vercel](https://vercel.com/docs/mcp/deploy-mcp-servers-to-vercel) is the canonical guide. It recommends Vercel Functions + Fluid compute for "MCP servers' irregular usage patterns (long idle times, quick message bursts, heavy AI workloads)", shows a full `createMcpHandler` route, built-in OAuth via `withMcpAuth` + a `/.well-known/oauth-protected-resource` metadata route, and links official templates ("MCP with Next.js", "MCP with Vercel Functions", xmcp).
- **Changelog:** [MCP server support on Vercel](https://vercel.com/changelog/mcp-server-support-on-vercel) (2025-05-07) announced the capability and the adapter, noting `@vercel/mcp-adapter` "has been renamed to `mcp-handler`."
- **Package status** (npm registry API, checked 2026-07-16):
  - `@vercel/mcp-adapter` — latest **0.3.2**; not flagged deprecated in registry metadata, but superseded. Do not use for new work.
  - `mcp-handler` — latest **1.1.0**; repo `github.com/vercel/mcp-handler`; peer deps `next >= 13.0.0` and `@modelcontextprotocol/sdk 1.26.0` (exact-pinned); bundles a `redis` dependency used only for the legacy SSE path. README: supports "Streamable HTTP and Server-Sent Events (SSE)", requires **Node.js 18+**, documents `basePath`, `maxDuration`, `verboseLogs`, and Redis as "optional, for SSE"; framework examples cover Next.js and Nuxt.
  - **Design note for ticket 007:** `mcp-handler` declares `next` as a peer dependency and exact-pins the MCP SDK version. Since this project already plans a shared core with two transports (stdio + Streamable HTTP), it is equally valid to use the `@modelcontextprotocol/sdk`'s own `StreamableHTTPServerTransport` in a plain Vercel Node function and skip `mcp-handler` — that avoids the Next.js peer-dep and the SDK version pin. Both paths are Vercel-supported (the "MCP with Vercel Functions" template is framework-less). This is an architecture choice for ticket 007, not a constraint.

---

## Open Questions

1. **Protection Bypass for Automation on Hobby** — the docs describe the feature without a plan gate, and the deployment-protection overview confirms Vercel Authentication + Standard Protection on Hobby, but no page states "bypass is available on Hobby" in so many words. Verify empirically when wiring CI (ticket 009); fallback is simply leaving preview protection off (previews of a public repo leak nothing sensitive so long as `METROLINX_API_KEY` stays server-side).
2. **Cold start latency in milliseconds** — no official figure exists for the Node.js runtime on Hobby; Vercel publishes only qualitative guidance and a platform-wide "99.37% of requests see zero cold starts" claim (blog, 2025-09-18, measured across all plans/optimizations). If first-call latency matters, measure it on the real deployment.
3. **Scale-to-one on Hobby** — the blog scopes scale-to-one to Pro/Enterprise production deployments; the fluid-compute docs describe pre-warming without plan qualification. Assume Hobby may scale to zero when idle.
4. **Metering of outbound external API calls** — the docs enumerate Fast Data/Origin Transfer but are silent on whether function→external-API egress (to Metrolinx) is separately metered on Hobby. Volume here is small; revisit only if the usage dashboard shows an unexpected line item.
