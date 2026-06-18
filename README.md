# testctl

[![CI](https://github.com/codekit-labs/testctl/actions/workflows/ci.yml/badge.svg)](https://github.com/codekit-labs/testctl/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

One command to run **Frappe, Flutter, Electron, Next.js (Vercel), Supabase, and Web (React/Vue
via Vitest/Jest)** tests and get a single unified report with a CI-friendly exit code.

`testctl` auto-detects which stacks exist in your project, runs only those (each
independently — a missing stack is skipped, never failed), and merges the results. It ships
as a **Claude Code plugin**, so failures are explained inline.

## Install (Claude Code plugin)

```
/plugin marketplace add codekit-labs/testctl
/plugin install testctl
/reload-plugins
```

Then, in any project (plugin commands are namespaced by the plugin name):

```
/testctl:test-all              # run every detected stack, analyze failures
/testctl:test-all nextjs       # run a single stack
/testctl:test-all web          # run React/Vue tests (Vitest or Jest)
```

You can also just ask in plain language — e.g. *"run all the tests for this project"* —
and the bundled skill handles it. The engine is bundled and dependency-free — nothing to
`npm install`.

## Requirements

The plugin works on any machine — it installs from GitHub and the engine is a self-contained
bundle. You only need, per machine:

- **Node.js ≥ 20** (runs the engine).
- The test toolchain for the stacks you actually test there — `flutter`, `npx jest`/`vitest`,
  `bench` (Frappe), `supabase`. A missing tool only affects that stack (it reports a clear
  error); the others still run.
- For **Frappe / Next.js**, a per-project `testctl.yaml` (paths/URLs differ per machine) —
  run `testctl init` and it auto-generates one.

Run `testctl doctor` (or `/testctl:doctor`) any time to check this machine: it reports the Node
version and which stack tools are installed, and lists the stacks it can test here.

**`testctl preflight`** — Frappe test-readiness check (dev requirements, allow_tests, encryption key, before_tests) with the exact fix for each gap.

## Updating

When a new version is released, refresh the marketplace and update the plugin:

```
/plugin marketplace update testctl
/plugin update testctl
/reload-plugins
```

(Or use the interactive `/plugin` menu → select `testctl` → Update.) Check your installed
version any time with `/plugin`.

## Generating tests

For an app that has few or no tests, let the plugin write them:

```
/testctl:generate-tests              # find untested apps and add smoke + unit tests
/testctl:generate-tests flutter      # only Flutter apps
/testctl:generate-tests ./apps/pos   # one app by path
```

It writes new test files (never overwriting existing ones), runs them until green, and leaves
them uncommitted for you to review and commit. Frappe tests are only run against a site with
`allow_tests` enabled.

## Fixing failures

When tests are red, let the plugin diagnose and fix them:

```
/testctl:fix-failures              # fix failures across the project
/testctl:fix-failures flutter      # only Flutter
/testctl:fix-failures ./apps/pos   # one app by path
```

It root-causes each failure (one at a time), applies a minimal fix to the app code — or
corrects a genuinely-wrong test, never weakening one to pass — re-runs to green, and leaves
changes uncommitted for review. Ambiguous or risky fixes are reported, not applied.

## Make a project production-ready

One command to drive the whole loop:

```
/testctl:production-ready            # discover → generate missing tests → run → fix → report
/testctl:production-ready flutter    # only Flutter
```

It discovers every app, generates tests where missing, runs them, fixes failures (bounded to a
few rounds per app), and prints a readiness report — ✅ green / ⚠️ partial / ⛔ needs-config —
leaving all changes uncommitted for you to review and commit.

A quiet SessionStart hook also makes Claude aware of these commands so it can offer the right
one when you're working on tests; it never runs anything automatically.

**Offer tests after coding:** when Claude edits source files in a turn, testctl offers to run the
tests at the end of it — *"want me to run `testctl run --changed --quiet --cache`?"* — so you don't
have to remember. It never runs anything on its own (you say yes/no), only fires on real source
changes (not docs/tests), once per change-batch. Turn it off with `autoOffer: false` in
`testctl.yaml`.

## Sharpen existing tests

Three skills go beyond "do they pass" to "are they any good":

```
/testctl:harden           # add edge cases (nulls, boundaries, error paths) to happy-path-only suites
/testctl:coverage-boost   # write tests for the exact uncovered lines, to a target %
/testctl:test-audit       # review tests for quality — find green-but-worthless suites, then fix safely
/testctl:mutation-testing # prove the tests catch bugs — break the code, find tests that don't fail
```

`harden` makes a suite meaner, `coverage-boost` targets the specific gaps from the coverage report,
and `test-audit` catches tests that pass without asserting anything. And `mutation-testing` goes further — it breaks the code on purpose and reports any test suite that doesn't notice, then writes the test that would have caught it. All additive, never weaken a
test, and leave changes uncommitted for review.

And three more for the rest of the lifecycle:

```
/testctl:regression-from-bug   # turn a bug / stack trace into a failing reproduction test, then fix
/testctl:flaky-hunter          # run a suite N times, find + stabilize the flaky tests
/testctl:data-factory          # generate reusable test-data builders (Frappe factories reuse masters)
/testctl:tax-guard             # protect VAT/GST/sales-tax correctness on invoices, from your tax config
```

```
/testctl:permissions-guard     # access control: deny unauthorized, enforce roles, isolate records
/testctl:money-guard           # money math: rounding, no float drift, totals reconcile, multi-currency
```

…and three that make writing tests easier:

```
/testctl:test-this             # describe a case in plain English → get the runnable test
/testctl:snapshot              # golden/snapshot tests for output-heavy code (no hand-written asserts)
/testctl:scaffold              # zero-to-one: set up the test harness for an app that has none
/testctl:mock-externals        # stub email/SMS/payment/webhooks/HTTP so tests never hit real services (Frappe: also workflow emails + PDF/wkhtmltopdf)
/testctl:security-guard        # defensive security tests for YOUR app: injection/XSS/access/secrets/SSRF/DoS-resilience
/testctl:frappe-bootstrap      # unblock Frappe test bootstrap: generate a test-only before_tests hook that front-loads the standard ERPNext _Test masters and flips Property-Setter-promoted mandatory fields in one pass; reviewable, never mutates the live site
```

> **Testing on restored production data?** Run `/testctl:mock-externals` so tests can't fire real
> emails/payments, and note that `--notify` payloads are PII-redacted (emails / phone & card numbers
> masked) — keep real customer data out of snapshots and fixtures too.

```
/testctl:date-tz-guard         # date/time: no tz off-by-one, DST, boundaries, duration math
/testctl:api-contract          # API: status codes, response shape, error envelope, auth, pagination
/testctl:migration-guard       # Frappe data patches: idempotent, no data loss, intended transform (calls execute() directly)
/testctl:perf-guard            # performance: no N+1 — expensive-call count must not grow with input size (deterministic, no wall-clock)
```

These guards are universal — each reads your project's own config (tax rates, auth/roles, currency
precision, timezone, API endpoints) and asserts the invariants, so they protect the high-stakes
areas (compliance, security, money, dates, APIs) on any stack and in any country.

`migration-guard` is Frappe-specific: it reads your app's own data patches (`patches.txt`) and tests
each for idempotency, no-crash, the intended transformation, and no collateral data loss — calling
`execute()` directly in a test (never a destructive `bench migrate`).

`perf-guard` pins performance as a deterministic invariant: it counts the DB queries / outbound calls
an operation makes over a small vs larger record set and fails if the count scales with N (an N+1) —
counts, not wall-clock, so the tests never flake.

## Run history

Every `run` is recorded to `.testctl/history.jsonl` in the project (the folder self-ignores via
its own `.gitignore`). See trends any time:

```
testctl report
```

It shows total runs, per-app pass-rate, flaky apps (ones that flip pass↔fail), and the last run.
History stays local and is never committed or uploaded.

## Failure digest

When tests fail, the machine-readable `TESTCTL_JSON` line includes a `failures[]` digest per app —
the failing test name, file/line, and a trimmed message — so tools (and `/testctl:fix-failures`)
can diagnose without parsing raw logs. Messages are trimmed and capped to stay small.

Every `run` also persists that digest to `.testctl/last-run.json`. Recall it any time **without
re-running** — a token-saver when you just need "what failed last time?":

```
testctl digest         # recall the last run's failures, no re-run
```

It prints per-stack counts and each failing test + message (exit 0), plus a `TESTCTL_DIGEST` JSON line
for tooling. Distinct from `--cache` (which skips green re-runs) and `report` (history trends).

## Work context (extreme token-saver)

```
testctl context        # one compact digest the skills act on
```

`testctl context` gives a test-skill its whole situational picture in **one cheap call** — per app:
its status, the failure digest, coverage gaps, a recommended action (generate / fix / boost / harden
/ ok), and the **untested functions/classes** (name + file:line) found by a dependency-free,
language-agnostic scan of your actual code. So the skills target exactly the gaps and open only the
files they need, instead of discovering → running → reading the whole project. Nothing is
hardcoded — it's derived from your code.

## Run only what changed

```bash
testctl run --changed          # only apps with uncommitted/untracked edits (multi-repo aware: scopes to each app's own git repo on a bench/monorepo)
testctl run --changed=main     # only what this branch changed vs main
testctl run --quiet            # summary + machine JSON only (no table)
```

`--changed` scopes path-based apps (Flutter/Electron/Supabase) to the files you edited; Frappe and
Next.js always run (their sources aren't locally path-mapped), and outside a git repo it runs
everything. `--quiet` keeps output minimal — the skills use it to spend fewer tokens.

## Watch mode

```bash
testctl run --watch                     # re-run on every save
testctl run --watch --changed --cache   # fast local loop: only what changed, skip green
```

`--watch` runs once then re-runs on file changes (debounced; noise dirs ignored) until you press
Ctrl-C. Combine with `--changed` and `--cache` for the tightest loop. (Recursive watching works on
macOS/Windows; Linux support may be limited.)

## Skip unchanged-and-green apps

```bash
testctl run --cache            # skip apps byte-identical to their last green run
```

testctl hashes each path-based app's source+tests; if it matches the last run where that app passed,
it's reported `✓ cached` and not re-run (no tokens spent on it). Change any file and it re-runs; an
app that was red last time always re-runs. State lives in `.testctl/cache.json` (git-ignored). You
can also set `cache: true` in `testctl.yaml`. Frappe/Next.js are never cached.

## CI reports (JUnit / SARIF)

```bash
testctl run --report-junit=report.xml     # JUnit XML — CI test summaries
testctl run --report-sarif=report.sarif   # SARIF 2.1.0 — GitHub inline annotations
```

Both are written from the same results testctl already computes (counts + the failure digest), so
they cost nothing extra. JUnit is understood natively by GitHub Actions, GitLab, and Jenkins; SARIF
drives inline annotations on a GitHub PR's "Files changed" tab. Bare `--report-junit` /
`--report-sarif` default to `testctl-junit.xml` / `testctl-sarif.json`. A write failure warns but
never changes the exit code.

To scaffold a ready-to-use CI workflow, run `testctl init --ci` — it writes
`.github/workflows/testctl.yml` (fetch engine → run → upload JUnit). Use `testctl init --ci=gitlab`
for a `.gitlab-ci.yml` instead. Add a Flutter setup step (`subosito/flutter-action`) if you test
Flutter in CI.

For a shareable human-friendly page, add `--report-html=report.html` — a standalone results page
(no external assets). For a PR/issue-paste-friendly summary, add `--report-md=report.md` (Markdown
table + failures).

## Notify on failure

```bash
testctl run --notify=https://hooks.example.com/...   # POST a summary when the run is red
```

On a red run, testctl POSTs `{ text, totals, failed[] }` to the URL (the `text` field renders in
Slack/Discord-style webhooks) and logs it as a `TESTCTL_NOTIFY` line. Green runs send nothing; a
failed POST warns but never changes the exit code.

## Retry flaky tests

```bash
testctl run --retry=2     # re-run a failing app up to 2 times
```

If an app passes on a retry it's marked `⚑ flaky (passed on retry K/N)` and the run stays green
(exit 0) — so a known-flaky suite (timing, network, DB-not-ready) doesn't break CI, while still
being visible. An app that fails every attempt stays red. Set a default with `retry: N` in
`testctl.yaml`. Retries only re-run *failing* apps, so green runs cost nothing extra.

## Explain failures

```bash
testctl run        # then:
testctl explain    # groups the last run's failures by root-cause signature
```

`explain` clusters similar failures (numeric variants collapse together) and shows which apps each
group spans — handy before `/testctl:fix-failures`, so a shared cause is fixed once.

## Coverage

Add `--coverage` to collect line-coverage % (Flutter, Electron, Frappe; others show `—`):

```
testctl run --coverage
testctl run --coverage flutter
```

Coverage is opt-in — normal runs stay fast and write no coverage artifacts. It's reported and
recorded, and (unless you set a gate, below) never affects the pass/fail exit code.

### Coverage gates

Turn coverage into a pass/fail gate:

```
testctl run --min-coverage=70        # fail any app below 70% line coverage
```

`--min-coverage` implies `--coverage`. You can also set a default in `testctl.yaml`:

```yaml
coverageMin: 70
stacks:
  # ...
```

`coverageMin` can also be a map for different bars per stack or app:

```yaml
coverageMin:
  flutter: 80
  electron: 60
  "apps/pos": 90      # by app label
  default: 50         # everything else
```

Resolution is label → stack → `default`. The `--min-coverage=N` flag still overrides everything.

The command-line flag overrides the config value. An app whose measured coverage is below the
threshold fails the run (exit 1) and shows the reason on its row
(`⚠ coverage X% < min Y%`). Apps that don't report line coverage (Next.js, Supabase) are never
gated.

When you run `/testctl:production-ready` with a gate configured, an app that has tests but is
below the gate is topped up automatically: testctl generates tests aimed at the uncovered logic,
re-measures, and (within 3 rounds) either lifts it over the gate or reports it as ⚠️ partial with
the real coverage numbers. Without a gate, `production-ready` only generates tests for apps that
have none.

## Parallel runs

Apps run concurrently by default (up to 4 at once). Tune it:

```
testctl run --concurrency=8     # more parallelism
testctl run --concurrency=1     # sequential
```

Results and exit code are identical to sequential — just faster on multi-app repos.

## Use without Claude Code

The same engine runs as a plain Node CLI (Node >= 20):

```bash
node dist/testctl.cjs init      # scaffold a testctl.yaml
node dist/testctl.cjs run       # run every detected stack
node dist/testctl.cjs run frappe
```

Exit code is `0` only if every stack that ran passed.

## Supported stacks

| Stack | Runs | Notes |
|-------|------|-------|
| Frappe | `bench run-tests` (JUnit XML) | site needs `allow_tests` enabled |
| Flutter | `flutter test --reporter json` | |
| Electron | `jest --json` | command overridable |
| Next.js | HTTP smoke checks vs the live **Vercel** URL | asserts status + optional body text |
| Supabase | `supabase test db` (pgTAP) | needs `supabase start` (Docker) running |
| Web (React/Vue) | `vitest run --reporter=json` or `jest --json` | runner auto-detected; reuses jest-JSON parser + coverage |

## Configuration (`testctl.yaml`)

Run `testctl init` to **auto-generate** this file: it detects your stacks, pre-fills the Frappe
bench/app it finds (scanning `~/frappe-bench*`) and a Next.js block, and marks anything it can't
be sure of with `<FILL-ME>`. Flutter/Electron/Supabase apps need no config — they're
auto-discovered.

All stacks are optional; absent ones are simply skipped.

```yaml
stacks:
  frappe:
    benchPath: /path/to/frappe-bench
    site: test
    apps: [your_app]
  flutter:
    path: ./mobile
  electron:
    path: ./desktop
  nextjs:
    vercelUrl: https://your-app.vercel.app
    checks:
      - { path: /, expectStatus: 200, expectText: "Welcome" }
      - { path: /api/health, expectStatus: 200 }
  supabase:
    path: ./
```

### Multiple Frappe sites

To test several sites/benches, make `frappe` a list — each entry is its own
`{ benchPath, site, apps }` (with an optional `ssh` block). Different sites run in parallel
(separate databases), and each gets its own report row:

```yaml
stacks:
  frappe:
    - { benchPath: /path/to/bench, site: site_a, apps: [app_a] }
    - { benchPath: /path/to/bench, site: site_b, apps: [app_b] }
```

A single `frappe:` object (shown above) still works unchanged. Apps within one site run serially
(they share that site's database); only different sites run concurrently.

### Running specific Frappe test modules

On a large ERPNext site, `bench run-tests --app` builds the whole test-record dependency graph,
which can be slow or fail. Scope to specific test modules instead:

```yaml
stacks:
  frappe:
    benchPath: /path/to/bench
    site: test_site
    apps: [my_app]
    modules:
      - my_app.my_app.doctype.thing.test_thing
```

testctl then runs `bench run-tests --module ...` for each entry. Omit `modules` to run the whole
app as before.

### Remote Frappe over SSH

Test a Frappe app on a remote bench by adding an `ssh` block (key or password). `benchPath` is
the **remote** path:

```yaml
stacks:
  frappe:
    ssh: { host: frappe@1.2.3.4, key: ~/.ssh/id_rsa }   # key (recommended)
    # or password via env var: ssh: { host: …, passwordEnv: TESTCTL_SSH_PASS }
    benchPath: /home/frappe/erp-bench
    site: demo.test          # a TEST site with allow_tests enabled — never production
    apps: [your_app]
```

Password auth uses `sshpass` (install it) and reads the password from the env var named by
`passwordEnv` — kept out of the file and the process list (never use `sshpass -p` on the command
line). Prefer keys or `passwordEnv` over an inline `password`. Remote runs report pass/fail
(coverage is local-only for now).

## Development

```bash
npm install      # dev/test/build deps
npm test         # run the test suite (node:test)
npm run build    # rebuild dist/testctl.cjs from lib/ + bin/
```

`dist/testctl.cjs` is the committed, self-contained bundle the plugin runs. CI rebuilds it and
fails if it is stale.

## License

MIT
