# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/), and this project adheres to
[Semantic Versioning](https://semver.org/).

## [1.37.2] - 2026-06-10

### Fixed
- **`bin/testctl.mjs` now works in a plugin clone with no `node_modules`.** It was the raw ESM
  source entry, which `import`s the npm deps (`yaml`, `fast-xml-parser`); since the plugin ships
  as a git clone with no `npm install`, running it crashed with `ERR_MODULE_NOT_FOUND` — anyone
  (or any model) who invoked the conventional `bin/` path hit it, even with the v1.37.1 hook fix.
  The real CLI source moved to `bin/cli.mjs` (the esbuild entry); `bin/testctl.mjs` is now a tiny
  dependency-free launcher that imports the bundled, fully-inlined `dist/testctl.cjs`. Both the
  `bin/` path and `dist/` path now run with zero install. `package.json`'s `bin` still points at
  `bin/testctl.mjs`, so a global/symlinked `testctl` also resolves to the dependency-free bundle.

## [1.37.1] - 2026-06-10

### Fixed
- Auto-offer-after-coding now suggests a **runnable** command. v1.36 offered a bare
  `testctl run …`, but there is no global `testctl` binary — Claude ran it and got
  `command not found`. The Stop hook now records the plugin root (via the PostToolUse marker) and
  offers `node "<plugin>/dist/testctl.cjs" run --changed --quiet --cache` (falling back to the
  `/testctl:test-all` command), and hints to run `… init` when a stack reports it needs a
  `testctl.yaml` instead of treating that as a failure.

## [1.37.0] - 2026-06-10

### Added
- **`/testctl:security-guard`** (skill) — generates **defensive** security tests for your own app:
  it feeds hostile-but-safe inputs to the project's real entry points and asserts safe handling —
  injection (SQL/command) parameterized/rejected, XSS escaped, broken access control / IDOR denied,
  no secrets in code/logs/responses, SSRF blocked, no eval/pickle on untrusted input, mass-assignment
  ignored, and input-size / pagination / rate limits enforced (DoS resilience). Discovers the
  project's own surface — nothing hardcoded. A real hole is reported as a security finding (→
  `fix-failures`), never exploited; strictly tests your own code, pairs with `mock-externals`.

## [1.36.0] - 2026-06-10

### Added
- Offer-tests-after-coding: when Claude edits source files in a turn, testctl now **offers** to run
  the tests at the end of that turn — "want me to run `testctl run --changed --quiet --cache`?" — so
  you don't have to remember. It never runs anything itself (you say yes/no), only triggers on real
  source changes (not docs/config/tests), fires once per change-batch, and is opt-out via
  `autoOffer: false` in `testctl.yaml`. Implemented as a quiet PostToolUse marker + a Stop hook;
  zero added context tokens.

## [1.35.0] - 2026-06-10

### Added
- **`/testctl:mock-externals`** (skill) — finds outbound integrations (email, SMS, payment,
  e-invoice/tax-authority, webhooks, third-party HTTP) and stubs them in tests, so the suite never
  hits real services. Critical when testing against a restored production copy that still carries
  live credentials. Asserts what *would* have been sent, never real delivery.
- **PII redaction for the notify webhook** — the `--notify` payload (and its logged `TESTCTL_NOTIFY`
  line) now mask emails and long digit runs (phones / cards / IBANs / IDs) before leaving the
  machine, so failure summaries from prod-data runs don't leak customer data. The `snapshot` and
  `test-audit` skills now also redact/flag PII (no real customer data in committed snapshots/fixtures).

## [1.34.0] - 2026-06-10

### Added
- Three skills that make authoring test cases simpler (markdown-only):
  - **`/testctl:test-this`** — describe a behaviour in plain English ("a Job with a 1000 invoice and
    a 500 payment shows Profit 500") and it writes the actual runnable test, runs it green, and
    leaves it for review. Say the case, get the test.
  - **`/testctl:snapshot`** — sets up snapshot / golden tests for output-heavy code (serializers,
    reports, API responses, widgets) so you don't hand-write assertions; normalizes non-determinism
    and asks you to confirm the captured baseline before trusting it.
  - **`/testctl:scaffold`** — zero-to-one: sets up the testing harness for an app that has none
    (jest/vitest, Flutter `test/`, Frappe test module, Supabase pgTAP) plus a first passing test, so
    `testctl run` works — then hands off to `generate-tests`.

## [1.33.0] - 2026-06-10

### Added
- **`testctl context`** — a token-cheap, one-call work digest the test-skills consume instead of
  discovering → running → globbing → reading whole files. Per app it reports: status + counts (from
  the last run), the failure digest, coverage + below-gate, a recommended **action**
  (generate / fix / boost / harden / ok), and the **untested functions/classes** (name + file:line)
  found by a dependency-free, language-agnostic scan (Python / Dart / JS-TS) — i.e. the symbols no
  test references yet. The `generate-tests`, `harden`, and `coverage-boost` skills now call it first
  and target exactly those symbols, opening only the files they need. Emits a compact
  `TESTCTL_CONTEXT` JSON line plus a human summary. Fully dynamic — derived from your actual code,
  nothing hardcoded.

## [1.32.0] - 2026-06-10

### Added
- Two more universal skills (markdown-only; each discovers the project's own config):
  - **`/testctl:date-tz-guard`** — tests date/time correctness: no timezone off-by-one, DST
    transitions, month/year/leap/fiscal boundaries, duration/age math, and date round-trips —
    asserting with explicit timezones, never the host's. Works with Frappe `getdate`/`now_datetime`
    + System Settings tz, JS date-fns/dayjs, and Flutter `DateTime`/`intl`.
  - **`/testctl:api-contract`** — contract tests for the app's API: correct status codes, response
    shape/required fields, the error envelope on bad input (Frappe `exc_type`/`_server_messages` or
    the documented error body), auth-required rejection, and pagination shape. Covers Frappe
    whitelisted methods, Next.js API routes, and REST controllers.

## [1.31.0] - 2026-06-10

### Added
- Two more universal guard skills (markdown-only; each discovers the project's own config rather
  than hardcoding):
  - **`/testctl:permissions-guard`** — tests that access control holds: unauthenticated requests are
    denied, role boundaries are enforced, and users can't read/modify records they shouldn't
    (record-level isolation, no privilege escalation). Works with Frappe DocType/Role permissions,
    Next.js/API auth guards, and Supabase RLS. A real access hole is surfaced as a security finding.
  - **`/testctl:money-guard`** — tests that money math is correct: rounding to each currency's
    precision, no floating-point drift, totals that reconcile (subtotal + tax + shipping − discount
    == grand total), and multi-currency conversion at the configured rate. Asserts exact amounts,
    never fuzzy comparisons.

## [1.30.0] - 2026-06-10

### Added
- **`/testctl:tax-guard`** (markdown-only skill): generates tests that protect tax correctness on
  invoices — tax line present + account set, tax = base × the configured rate (rounded), totals add
  up, rate-by-category (standard / zero-rated / exempt), tax-ID present where required. It discovers
  the project's *own* tax configuration rather than hardcoding a rate, so it works for any country
  (KSA ZATCA, India GST, EU/UK VAT, US sales tax are just instances). Country-specific e-invoice /
  QR / XML checks are an optional add-on, gated on that compliance app being installed.

## [1.29.0] - 2026-06-10

### Added
- Three more test-case skills (markdown-only; engine unchanged):
  - **`/testctl:regression-from-bug`** — turns a bug report / stack trace into a test that
    reproduces it FIRST (red, for the right reason), then hands the fix to `fix-failures`. Proper
    TDD for bug-fixing.
  - **`/testctl:flaky-hunter`** — runs a suite several times, isolates the tests that flip
    pass↔fail, diagnoses the cause (timing, order-dependence, shared state, non-determinism), and
    stabilizes them — never hides flakiness behind a retry.
  - **`/testctl:data-factory`** — generates reusable test-data builders/factories so tests stop
    hand-rolling fixtures; for Frappe/Supabase the factories REUSE existing masters and never create
    heavyweight records that trigger framework setup cascades.

## [1.28.0] - 2026-06-10

### Added
- `testctl doctor` now prints the installed `testctl vX.Y.Z` at the top of its report (#1).
- `testctl init --ci=gitlab` scaffolds a `.gitlab-ci.yml` (fetch the engine → run →
  `artifacts:reports:junit`) alongside the existing GitHub Actions template; `--ci` (or
  `--ci=github`) is unchanged. Never overwrites an existing file (#3).

## [1.27.0] - 2026-06-10

### Added
- Three new test-case skills (markdown-only; engine unchanged):
  - **`/testctl:harden`** — adds adversarial edge-case tests (nulls, boundaries, error paths,
    large/unicode input, domain edges) to apps that only have happy-path tests; additive, never
    overwrites, reports any real bug it surfaces.
  - **`/testctl:coverage-boost`** — reads the coverage report (lcov / jest-summary / cobertura) to
    find the *specific* uncovered functions/branches and writes tests for exactly those, bounded to
    3 rounds, reporting `coverage X% → Y%`.
  - **`/testctl:test-audit`** — reviews existing tests for quality (assertions that don't assert,
    can't-fail tautologies, over-mocking, brittle sleeps/selectors, order-dependence, missing
    teardown, silently-skipped tests), reports them ranked by severity, and safely strengthens the
    unambiguous ones — never weakening a test.

## [1.26.0] - 2026-06-10

### Added
- `testctl run --report-md[=path]` writes a Markdown results summary (a GFM table of apps + a
  failures section) — paste-ready for PRs/issues. Bare flag → `testctl-report.md`. Best-effort;
  never changes the exit code. Thanks to @64johnlee for the first community contribution (#2/#4).

## [1.25.0] - 2026-06-08

### Added
- `testctl run --watch`: run once, then re-run automatically on file changes (debounced; ignores
  node_modules/.git/build/.testctl/etc.) until Ctrl-C. Pairs with `--changed`/`--cache` for a fast,
  scoped local TDD loop. (Recursive watching is supported on macOS/Windows; on Linux it may be
  limited.)

## [1.24.0] - 2026-06-08

### Added
- `testctl run --notify=<url>`: when a run goes red, POST a compact JSON failure summary
  (`text` + `totals` + `failed[]`) to a webhook (Slack/Discord-style `text` renders directly). The
  outbound payload is logged as a `TESTCTL_NOTIFY` line. Best-effort — a POST failure warns but
  never changes the exit code; green runs send nothing.

## [1.23.0] - 2026-06-08

### Added
- `testctl run --report-html[=path]` writes a single self-contained HTML results page (per-app
  pass/fail/coverage + a failures section) — shareable, no external assets. Bare flag →
  `testctl-report.html`. Best-effort; never changes the exit code.

## [1.22.0] - 2026-06-08

### Added
- `testctl explain`: after a run, prints the failures grouped by a normalized signature — "N
  failures across M apps → K groups" — so a shared root cause is fixed once instead of per-test.
  Reads `.testctl/last-run.json` (written by every `run`); no re-run needed.

## [1.21.0] - 2026-06-08

### Added
- `testctl init --ci` scaffolds `.github/workflows/testctl.yml` — a turnkey GitHub Actions workflow
  that fetches the dependency-free engine bundle, runs `testctl run --quiet --report-junit=…`, and
  uploads the JUnit report. Never overwrites an existing workflow.

## [1.20.0] - 2026-06-08

### Added
- Per-stack / per-app coverage gates: `coverageMin` in `testctl.yaml` may now be a map keyed by
  stack and/or app label (e.g. `{ flutter: 80, electron: 60, "apps/pos": 90, default: 50 }`),
  resolved label → stack → default per app. A plain number still works (global), and
  `--min-coverage=N` still overrides everything as a global number.

## [1.19.0] - 2026-06-08

### Added
- `testctl run --retry=N` (or `retry: N` in `testctl.yaml`): re-run a failing or errored app up to N
  times; if it passes on a retry it's reported flaky (`⚑ passed on retry K/N`) and counts as green
  (exit 0) instead of failing the build, while still being surfaced. An app that fails all attempts
  stays red (`failed after N retries`). Opt-in; composes with `--cache`/`--changed`/reports.

## [1.18.0] - 2026-06-08

### Added
- CI report export: `testctl run --report-junit[=path]` writes a JUnit XML report (rendered as a
  test summary by GitHub Actions / GitLab / Jenkins) and `--report-sarif[=path]` writes SARIF 2.1.0
  (inline PR annotations on GitHub). Built from the per-app counts + failure digest; best-effort
  (a write error warns but never changes the exit code). Bare flags default to
  `testctl-junit.xml` / `testctl-sarif.json`.

## [1.17.0] - 2026-06-08

### Added
- `testctl run --cache` (or `cache: true` in `testctl.yaml`): skip a path-based app
  (Flutter/Electron/Supabase) when its source+test files are byte-identical to the last run where it
  passed — shown as `✓ cached`, with no test execution and no skill work. State-aware (unchanged-but-
  red apps still re-run), git-independent, persisted in `.testctl/cache.json`. Frappe/Next.js always
  run. Opt-in; without it, behavior is unchanged. Composes with `--changed`/`--quiet`.

## [1.16.0] - 2026-06-07

### Added
- `testctl run --changed[=<ref>]`: run only targets affected by your git changes (working tree +
  staged + untracked, or vs a ref). Path-based stacks (Flutter/Electron/Supabase) are scoped to the
  apps you touched; Frappe/Next.js always run (conservative); outside a git repo it fails open and
  runs everything. Big token saver on monorepos.
- `testctl run --quiet`: print only the one-line summary, `TESTCTL_JSON`, and the exit code (no
  discovery list or results table). The bundled skills now run the engine with `--quiet`, so they
  pull less into context — friendlier to small plans and prompt-cache reuse.

## [1.15.0] - 2026-06-07

### Added
- Failure digest: every result now carries a compact `failures[]` (test name, file/line, trimmed
  message) in `TESTCTL_JSON`, extracted from each runner's own output (jest, flutter, JUnit, TAP,
  HTTP checks). Messages are trimmed (~800 chars) and capped (20 per app). `/testctl:fix-failures`
  reads this digest instead of reopening full logs — fewer tokens, faster diagnosis. The human
  report table is unchanged.

## [1.14.0] - 2026-06-07

### Added
- Frappe test scoping: a `frappe` target may set `modules: [dotted.test.module, ...]` to run
  `bench run-tests --module <m>` for each instead of `--app`. This avoids the heavy ERPNext
  test-record bootstrap (which can crash on real/restored sites), so you can run just your app's
  tests. Without `modules`, behaviour is unchanged (`--app`). Works locally and remote over SSH.

## [1.13.0] - 2026-06-06

### Added
- Multi-site Frappe: `stacks.frappe` may now be a **list** of `{ benchPath, site, apps, ssh? }`
  site-targets. Different sites run **in parallel** (separate databases — safe, including remote
  over SSH), while apps within a site stay serial. Each site is reported on its own row
  (`Frappe (site_a)`). A single `frappe:` object behaves exactly as before.

## [1.12.1] - 2026-06-06

### Removed
- Internal cleanup: dropped the unused `detectStacks` helper (superseded by the discovery walk)
  and the report's never-reached "not present" branch. No behaviour change — discovery already
  only yields apps that exist.

## [1.12.0] - 2026-06-06

### Changed
- `production-ready` (and `/testctl:production-ready`) now raises coverage: when a gate is
  configured (`coverageMin:` in `testctl.yaml` or `--min-coverage=N`), an app that has tests but
  is below the gate is treated like an untested app — it generates more tests targeting uncovered
  logic, re-measures, and (bounded to the same 3 rounds) either crosses the gate or is reported as
  ⚠️ partial with the real numbers. With no gate set, behaviour is unchanged. Skill-only change;
  the engine and bundle are untouched.

## [1.11.0] - 2026-06-06

### Added
- Coverage gates: `testctl run --min-coverage=N` (or `coverageMin: N` in `testctl.yaml`; the flag
  wins) fails the run (exit 1) for any app whose measured line coverage is below N, with the reason
  shown on its report row (`⚠ coverage X% < min Y%`). `--min-coverage` implies `--coverage`. Apps
  that can't measure coverage (Next.js, Supabase, or `--coverage` off) are never gated.

## [1.10.0] - 2026-06-06

### Changed
- Discovered apps now run **in parallel** (default concurrency 4; `testctl run --concurrency=N`,
  `--concurrency=1` for sequential). Runners use async spawn under the hood; report, exit code,
  and history are unchanged (results stay in discovery order) — just faster on monorepos.

## [1.9.0] - 2026-06-06

### Added
- Remote Frappe over SSH: a `frappe.ssh` config (`{ host, key | passwordEnv | password, port }`)
  runs `bench run-tests` on a remote bench and pulls the JUnit XML back. Key-based, or password
  via `sshpass -e` (password supplied through the `SSHPASS` env — never on the command line).
  Remote runs report pass/fail; use a test site with `allow_tests`, never production.

## [1.8.0] - 2026-06-06

### Added
- `testctl doctor` (and `/testctl:doctor`): a read-only health check reporting the Node version
  (>= 20) and which stack tools (flutter, bench, supabase) are installed, plus the "ready
  stacks" for this machine. Exit 1 only if Node < 20.

## [1.7.1] - 2026-06-06

### Changed
- `testctl report` now shows a per-app coverage column (last recorded %).
- Smart `init` caps the Frappe sites hint at 6 names + "(…N more)" so it stays readable on
  benches with many sites.
- README: added a "Requirements" section (Node ≥ 20 + per-stack tools) for installing on other
  machines.

## [1.7.0] - 2026-06-06

### Added
- Opt-in coverage: `testctl run --coverage` collects line-coverage % for Flutter (lcov),
  Electron (jest json-summary), and Frappe (Cobertura xml), shown in the report and recorded in
  history. Next.js/Supabase show `—`. Coverage never affects the pass/fail exit code.

## [1.6.0] - 2026-06-06

### Changed
- `testctl init` is now project-aware: it detects stacks, pre-fills a Frappe block (scanning
  `~/frappe-bench*` for the bench that has your app, and listing that bench's sites) and a
  Next.js block, notes auto-discovered Flutter/Electron/Supabase apps, and marks uncertain
  values with `<FILL-ME>`. Existing `testctl.yaml` files are never overwritten.

## [1.5.0] - 2026-06-06

### Added
- Run history: every `testctl run` appends a record to `.testctl/history.jsonl` (best-effort;
  the folder self-ignores). New `testctl report` command summarizes total runs, per-app
  pass-rate, flaky apps, and the last run. History stays local.
- GitHub issue templates (bug / feature / tuning-feedback), a PR template, and a CONTRIBUTING
  "Fine-tuning" guide.

## [1.4.0] - 2026-06-06

### Added
- `production-ready` skill and `/testctl:production-ready` command: orchestrates the full loop —
  discover apps → generate missing tests → run → fix failures → re-run (bounded to 3 rounds per
  app) → readiness report (✅ green / ⚠️ partial / ⛔ blocked). Reuses generate-tests and
  fix-failures; never auto-commits.
- Quiet SessionStart hook: injects a one-line awareness of the testctl commands so Claude can
  offer them when relevant. Never auto-runs and never repeats.

## [1.3.0] - 2026-06-06

### Added
- `fix-failures` skill and `/testctl:fix-failures` command: Claude root-causes failing tests
  (one at a time, via the systematic-debugging skill), applies a minimal fix to the app code or
  corrects a genuinely-wrong test (never weakening a test to pass), re-runs to green, and leaves
  changes uncommitted for review. Ambiguous/architectural/behavior-changing fixes are reported,
  not applied. Frappe tests only run against an `allow_tests` site.

## [1.2.0] - 2026-06-06

### Added
- `generate-tests` skill and `/testctl:generate-tests` command: Claude writes runnable smoke +
  unit-logic tests for untested apps across Flutter, Electron, Next.js, Frappe, and Supabase,
  runs them to green, and leaves them in the working tree for review (never auto-commits;
  Frappe tests only run against an `allow_tests` site).

## [1.1.1] - 2026-06-06

### Fixed
- An incompletely-configured Frappe stack (e.g. `benchPath` set but missing `site`/`apps`)
  now shows a non-failing "needs config" notice instead of erroring and failing the whole run.

## [1.1.0] - 2026-06-06

### Added
- Monorepo discovery: testctl now walks subdirectories and runs every Flutter, Electron, and
  Supabase app it finds, each reported by its relative path. Discovery prunes inside matched
  apps and skips `node_modules`, `.git`, build output, etc.

### Changed
- Next.js (needs `vercelUrl`) and Frappe (needs bench/site/apps) detected on disk but not
  configured now show a non-failing "needs config" notice instead of erroring the whole run.
- Result objects carry `label` (the app's relative path) and `note`.

## [1.0.1] - 2026-06-06

### Changed
- README: corrected the command to the namespaced `/testctl:test-all`, added an **Updating**
  section (`/plugin marketplace update` + `/plugin update` + `/reload-plugins`), and noted
  plain-language invocation.
- Tuned the `test-all` skill description so natural-language requests ("run all tests",
  "test this project") reliably trigger it.

## [1.0.0] - 2026-06-06

### Added
- Initial release as a Claude Code plugin.
- Unified test runner across five stacks, each detected per-project and run independently:
  - **Frappe** — `bench run-tests` with JUnit XML parsing.
  - **Flutter** — `flutter test --reporter json`.
  - **Electron** — `jest --json` (command overridable).
  - **Next.js** — HTTP smoke checks against the live Vercel URL (status + optional body text).
  - **Supabase** — `supabase test db` (pgTAP / TAP).
- Per-project detection: absent stacks are skipped, never failed.
- Merged report with a CI-friendly exit code (0 only if every stack that ran passed).
- `/test-all` command and skill that run the engine and analyze failures inline.
- Dependency-free bundled engine (`dist/testctl.cjs`) — runs after `git clone` with no install.
- Machine-readable `TESTCTL_JSON` output line with per-stack results and failure logs.
