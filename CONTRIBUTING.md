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
