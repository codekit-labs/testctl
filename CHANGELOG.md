# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/), and this project adheres to
[Semantic Versioning](https://semver.org/).

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
