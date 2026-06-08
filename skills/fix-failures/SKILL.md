---
name: fix-failures
description: Diagnose and fix failing tests for an app — root-cause each failure, apply a minimal fix to the app code (or correct a genuinely-wrong test), re-run to green, and leave changes uncommitted for review. Use when the user runs /testctl:fix-failures, or says "fix the failing tests", "make the tests pass", "debug the test failures", or wants red tests fixed.
---

# fix-failures

Turn a red test suite green by fixing the underlying cause — safely, one failure at a time,
leaving changes for review. This skill does NOT re-derive debugging: it hands off to the
`systematic-debugging` and `test-driven-development` skills.

## Inputs

`/testctl:fix-failures [path-or-stack]`: a path or stack narrows the scope; empty = the whole
project.

## Steps

1. **Find real failures.** Run the engine:
   `node "<skill-base>/../../dist/testctl.cjs" run --quiet` (scoped to the arg if given) and read
   the `TESTCTL_JSON` line. Take the `results[]` entries with `failed > 0` — IGNORE "needs config"
   notices and not-present stacks. Each such entry carries a `failures[]` digest
   (`{ test, file, line, message }` per failing test). If there are none, say "no failures" and stop.
   To scope to just what you edited (fewer tokens), add `--changed` (or `--changed=<ref>`).

2. **For each failure, ONE AT A TIME (never batch):**
   a. Read the failure's digest entry (`test`, `file`, `line`, `message`) from `failures[]` — that
      is usually enough to root-cause. Open the raw log at `rawLogPath` ONLY when the digest lacks
      detail. Then read the implicated app/test code.
   b. **Root-cause it** — invoke the `systematic-debugging` skill. Find WHY it fails; do not
      patch the symptom.
   c. **App vs test:** if the test correctly encodes intended behavior, fix the **app**. If the
      test is genuinely wrong/brittle, fix the **test** — but NEVER weaken, `skip`, or delete a
      test just to make it pass.
   d. **Risk gate:** if the fix is clear and low-risk, apply the **minimal** change. If it is
      ambiguous, architectural, or could change behavior elsewhere, **STOP**: record the
      diagnosis + proposed fix and move on WITHOUT editing.
   e. **Verify** — re-run that test (follow `test-driven-development`: it must go red→green).
      If it's still red after ~2 focused attempts, stop on it and report — do not thrash.

3. **Re-run the full suite** to confirm no regressions were introduced by the fixes.

4. **Leave for review.** Do NOT commit. Print, per failure: root cause → file changed →
   result (✅ green / ⏸ stopped-on-risk with the proposed fix). Tell the user to review the
   `git diff` and commit.

## Rules

- One failure at a time; isolate cause and fix.
- NEVER weaken/skip/delete a test to force green (a genuinely-wrong test may be corrected, with
  the reason stated).
- Stop and report risky/ambiguous/architectural fixes — don't force them.
- Bounded retries (~2 per failure) — no thrashing.
- Never commit to the user's repos.
- A failure counts as fixed ONLY after its test re-runs green (verification-before-completion).
- Frappe: only run tests against a site with `allow_tests` enabled — never production data.
