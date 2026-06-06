# Contributing

Thanks for your interest in improving testctl.

## Setup

```bash
npm install
```

Requires Node.js >= 20.

## Workflow

- **Run the tests:** `npm test` (uses the built-in `node:test` runner).
- **Rebuild the bundle:** `npm run build` — regenerates `dist/testctl.cjs` from `lib/` + `bin/`.
- Always commit a rebuilt `dist/testctl.cjs` when you change anything under `lib/` or `bin/`.
  CI fails if the committed bundle is stale.

## Project layout

```
bin/testctl.mjs    CLI entry (dev; imports from lib/)
lib/               engine source: detection, config, report, runners/*
dist/testctl.cjs   committed dependency-free bundle (what the plugin runs)
test/              node:test suites + fixtures
skills/, commands/ Claude Code plugin surface
scripts/build.mjs  esbuild bundler
```

## Adding a stack

Each stack is: a detection branch in `lib/detect.mjs`, a runner in `lib/runners/<stack>.mjs`
returning the uniform `makeResult` shape, a label in `lib/report.mjs`, and a branch in
`bin/testctl.mjs`. Add a parser unit test with a fixture. Then `npm test` and `npm run build`.

## Pull requests

Keep changes focused, include tests, and make sure `npm test` and `npm run build` are clean
before opening a PR.

## Fine-tuning

testctl has two layers — tune the right one:

- **Behavior (skills, markdown):** how Claude generates/fixes/orchestrates lives in
  `skills/*/SKILL.md` and `skills/generate-tests/stack-conventions.md`. Edit these to change
  test patterns, rules, or stop-on-risk thresholds. No build needed.
- **Engine (`lib/`, code):** detection, parsing, history, the runners. Change via TDD
  (`npm test`), then `npm run build` to refresh `dist/testctl.cjs`.

**The loop:** edit → `npm test` → `npm run build` (if engine) → bump version + CHANGELOG →
commit → push → `/plugin update testctl` → `/reload-plugins`.

**Capturing cases:** when a generated test or fix is wrong, open a `tuning_feedback` issue with
the diff and the desired behavior, then encode the lesson as a rule in the relevant SKILL.md or
a guard/test in the engine.
