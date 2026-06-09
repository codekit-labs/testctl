# Contributing to testctl

Thanks for your interest in improving **testctl** — a unified test runner for Frappe, Flutter,
Electron, Next.js, and Supabase, shipped as a Claude Code plugin and a plain Node CLI.

Contributions of every size are welcome: bug reports, docs, a new stack, a new flag, or just
telling us what would make testctl a daily driver for your setup.

## Quick start

```bash
git clone https://github.com/codekit-labs/testctl
cd testctl
npm install            # dev-only deps (esbuild, yaml, fast-xml-parser); Node >= 20
npm test               # the full node:test suite — should be all green
```

Run the CLI locally without installing anything:

```bash
node bin/testctl.mjs --help
node bin/testctl.mjs run        # in any project directory
```

## Ways to contribute

- 🐛 **Report a bug** — open a [bug report](.github/ISSUE_TEMPLATE/bug_report.md) with the command,
  the output, and your OS/Node version.
- 💡 **Request a feature or a stack** — open a [feature request](.github/ISSUE_TEMPLATE/feature_request.md).
- 🔧 **Send a PR** — see the workflow below. Look for issues labelled **`good first issue`** to start.
- 🧪 **Tuning feedback** — if a generated test or an auto-fix was wrong, open a
  [tuning feedback](.github/ISSUE_TEMPLATE/tuning_feedback.md) issue with the diff and the desired
  behaviour.

## How it's built (the two layers)

testctl has two layers — change the right one:

- **Engine (`lib/`, `bin/` — code):** detection/discovery, config, the per-stack runners, report,
  coverage, history, and all the `run` flags. Pure functions where possible, each covered by a
  `node:test` unit test. Compiled into a single dependency-free bundle, `dist/testctl.cjs`.
- **Behaviour (`skills/*/SKILL.md` — markdown):** how Claude generates tests, fixes failures, and
  orchestrates `production-ready`. No build step — just edit the markdown.

```
bin/testctl.mjs       CLI entry (dev; imports from lib/)
lib/                  engine source — one focused .mjs per concern
lib/runners/<stack>   one runner per stack, returning the uniform makeResult shape
dist/testctl.cjs      committed dependency-free bundle (what the plugin actually runs)
test/                 node:test suites + fixtures (one per feature)
skills/, commands/    Claude Code plugin surface
scripts/build.mjs     esbuild bundler
```

## Dev loop (engine changes)

We work **test-first**:

1. Write or extend a `test/…test.mjs` for the behaviour you want — run `npm test`, watch it fail.
2. Implement the minimal change in `lib/` (keep pure logic in small, testable functions).
3. `npm test` until green.
4. `npm run build` to regenerate `dist/testctl.cjs` (**required** whenever you touch `lib/` or
   `bin/` — CI fails on a stale bundle).
5. Update `CHANGELOG.md` and, for a release, bump the version in `package.json` and
   `.claude-plugin/plugin.json`.

Behaviour-only (skills/markdown) changes skip steps 1–4 — no build needed.

## Adding a new stack

A stack is small and additive:

1. **Detect** it — add a predicate in `lib/detect.mjs` and wire discovery in `lib/discover.mjs`.
2. **Run** it — add `lib/runners/<stack>.mjs` returning the uniform `makeResult({...})` shape
   (`{ passed, failed, skipped, coverage, failures, … }`).
3. **Label** it — add an entry in `lib/report.mjs` and the `STACKS` array in `bin/testctl.mjs`.
4. **Test** it — add a parser unit test with a fixture under `test/`.
5. `npm test` → `npm run build`.

The existing runners (`flutter`, `electron`, `frappe`, `nextjs`, `supabase`) are good templates.

## Pull request checklist

- [ ] `npm test` is green (and you added/updated tests for your change).
- [ ] `npm run build` was run and the rebuilt `dist/testctl.cjs` is committed (if you touched
      `lib/`/`bin/`).
- [ ] `CHANGELOG.md` updated.
- [ ] The change is focused — one feature/fix per PR.
- [ ] Commit messages are clear; the PR description says what and why.

Open the PR against `main`. CI runs the suite and checks the bundle isn't stale.

## Code style

ES modules (`.mjs`), Node ≥ 20, no runtime dependencies in the shipped bundle (dev-only deps are
fine). Prefer small pure functions + a focused test over clever one-liners. Match the surrounding
style.

## Fine-tuning the AI behaviour

testctl's skills decide how tests are generated/fixed/orchestrated. To change that behaviour, edit
the relevant `skills/*/SKILL.md` (and `skills/generate-tests/stack-conventions.md` for per-stack
patterns) — no build needed. When a generated test or fix is wrong, open a `tuning_feedback` issue
with the diff and the desired behaviour, then encode the lesson as a rule in the SKILL.md or a
guard/test in the engine.

## Code of conduct

Be kind and constructive. Assume good intent. We're all here to make testing across stacks less
painful.
