# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/), and this project adheres to
[Semantic Versioning](https://semver.org/).

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
