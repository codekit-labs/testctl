---
name: mutation-testing
description: Prove an app's tests actually catch bugs — apply small surgical mutations to high-value code, re-run the suite, and report any mutation that SURVIVES (no test failed = a real gap), then write a test that kills each survivor. The active complement to test-audit. Use when the user runs /testctl:mutation-testing, or says "are my tests real", "do my tests actually catch bugs", "mutation testing", "test my tests", "prove the suite works", or suspects green tests that protect nothing.
---

# mutation-testing

`test-audit` reads tests and *guesses* they're weak. `mutation-testing` *proves* it: it breaks the
code on purpose and checks that a test screams. If you can change `>` to `>=`, drop a `return`, or
flip an `if` and every test still passes, those tests protect nothing — and this skill finds exactly
which ones, then writes the test that would have caught it.

Surgical and dependency-free: Claude applies one mutation at a time by editing the code, so it works
on every stack (Frappe, Flutter, Electron, Next.js, Supabase, Web) with no per-language tool.

## Inputs

`/testctl:mutation-testing [path-or-stack]`: a path/stack narrows scope; empty → confirm the target
list first, then focus on the highest-consequence logic (see Step 2).

## Steps

1. **Establish a green baseline.** Run `node "<skill-base>/../../dist/testctl.cjs" run <path-or-stack>
   --quiet` and read `TESTCTL_JSON`. You CANNOT mutation-test a red or empty suite:
   - any failures → stop, point at `/testctl:fix-failures` (fix first).
   - target has no tests (passed + failed == 0) → stop, point at `/testctl:generate-tests`.

2. **Pick targets (high-consequence first).** If a path/stack was given, use it. Otherwise confirm the
   list with the user, then prioritize:
   - money / tax / permission / date-time functions (the domains the guard skills protect),
   - code surfaced by `node "<skill-base>/../../dist/testctl.cjs" run --changed --quiet` (recently edited),
   - thinly-tested symbols from `node "<skill-base>/../../dist/testctl.cjs" context` (`TESTCTL_CONTEXT`).
   Cap at ~8–15 mutation sites per run to stay fast. **State what you sampled** (e.g. "mutated 12 sites
   across 3 functions") — never silently truncate.

3. **For each site, run the loop — ONE mutation at a time:**
   a. Apply exactly one mutation from the catalog (edit a single operator/return/branch).
   b. Re-run the scoped suite: `node "<skill-base>/../../dist/testctl.cjs" run <same-scope> --quiet`.
      - a test now FAILS → mutant **KILLED** (the suite catches it — good).
      - suite still GREEN → mutant **SURVIVED** (a real gap — record file:line + the mutation).
   c. **Revert immediately** — restore the file byte-for-byte before touching the next site.

   **Mutation catalog** (apply by reading the code; pick mutations that genuinely change behavior):
   - Comparison: `>`↔`>=`, `<`↔`<=`, `==`↔`!=`.
   - Boolean: `&&`↔`||`; drop a `!`.
   - Arithmetic / off-by-one: `+`↔`-`, `*`↔`/`; `±1` on a bound.
   - Return / constant: `return x` → `return None`/`0`/`""`; `true`↔`false`.
   - Remove a guard: delete an `if` precondition / early-return.

   Skip likely **equivalent mutants** (edits that don't change observable behavior, e.g. reordering a
   commutative sum) — they aren't real gaps.

4. **Report survivors**, ranked by severity:
   - 🔴 critical-logic survivor (money/tax/permission/date or a core branch),
   - 🟡 minor.
   Each line: `file:line`, `original → mutated`, and a one-line *why no existing test caught it*.
   Zero survivors is a strong positive — say so plainly ("N mutations, all killed — these tests
   genuinely catch regressions").

5. **Write a killing test for each survivor** (in the `harden` style; place it with the app's other
   tests). Then **confirm it works both ways**: re-apply the mutation → the new test must FAIL; revert
   the mutation → the new test must PASS. Then revert the mutation for good.

6. **Frappe safety:** only run against an `allow_tests` site.

7. **Leave for review.** Do NOT commit. Print the survivor report + the killing tests written. Tell the
   user to review `git diff` and commit.

## Rules

- **Sacred:** mutate one site at a time; ALWAYS revert to the exact original before the next. After the
  run, verify the working tree shows only the new test files — never a mutated source line. A mutant
  must never survive into a commit.
- Mutating app code is safe on restored production data ONLY because every mutation is reverted
  immediately and never committed — never leave a mutation in place.
- A killing test must fail on the mutation and pass on the original — verify both directions.
- Never weaken or delete existing tests; this skill only adds tests that kill survivors.
- Never commit; never auto-fix the app code (the bug is in the *tests'* coverage, not the code).
- Don't mutate non-logic: generated files, pure markup, configs, vendored code.
