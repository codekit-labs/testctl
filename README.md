# testctl

[![CI](https://github.com/codekit-labs/testctl/actions/workflows/ci.yml/badge.svg)](https://github.com/codekit-labs/testctl/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

One command to run **Frappe, Flutter, Electron, Next.js (Vercel), and Supabase** tests and
get a single unified report with a CI-friendly exit code.

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
```

You can also just ask in plain language — e.g. *"run all the tests for this project"* —
and the bundled skill handles it. The engine is bundled and dependency-free — nothing to
`npm install`.

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

## Run history

Every `run` is recorded to `.testctl/history.jsonl` in the project (the folder self-ignores via
its own `.gitignore`). See trends any time:

```
testctl report
```

It shows total runs, per-app pass-rate, flaky apps (ones that flip pass↔fail), and the last run.
History stays local and is never committed or uploaded.

## Coverage

Add `--coverage` to collect line-coverage % (Flutter, Electron, Frappe; others show `—`):

```
testctl run --coverage
testctl run --coverage flutter
```

Coverage is opt-in — normal runs stay fast and write no coverage artifacts. It's reported and
recorded, but never affects the pass/fail exit code.

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
