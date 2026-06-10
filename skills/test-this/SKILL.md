---
name: test-this
description: Turn a plain-English description of a behaviour into a real, runnable test — "a Job with a 1000 invoice and a 500 payment shows Profit 500", "the cart adds 15% VAT" — across Flutter, Electron, Next.js, Frappe, and Supabase. Use when the user runs /testctl:test-this, or describes a case in words and says "write a test for this", "test that ...", "add a test where ...", or wants to author a specific test by describing it instead of writing it.
---

# test-this

The simplest possible authoring: **say the case, get the test.** The user describes a behaviour in
words; this skill writes the actual runnable test that encodes it, runs it green, and leaves it for
review. Additive. Read `../generate-tests/stack-conventions.md` and reuse `data-factory` (factories)
and `testctl context` (to locate the code) where helpful.

## Inputs

`/testctl:test-this [plain-English behaviour]`: e.g. "create_invoice on a job with no items throws",
or "discount of 10% on a 200 order leaves 180". If the description is ambiguous, ask one focused
question (the exact input, or the exact expected result) before writing.

## Steps

1. **Parse the scenario.** Extract: the unit under test (function / endpoint / widget), the **given**
   input/state, and the **expected** result. If a number/expectation is implied but not stated, ask.

2. **Locate the code.** Use `node "<skill-base>/../../dist/testctl.cjs" context` (token-cheap) and a
   quick read of the named unit to confirm its signature and how to drive it. Reuse existing
   factories/masters (`data-factory` rule — never create heavyweight records).

3. **Write ONE focused test** in a NEW, clearly-named test (never overwriting existing tests) that
   encodes exactly the described case: arrange the **given**, act, assert the **expected**. Name the
   test after the behaviour ("subtracts discount from total").

4. **Run it green.** Fix the GENERATED test on failure — not the app. If the described behaviour
   reveals a real bug (the app doesn't do what the user expects), do NOT patch app code: report it
   and ask whether to run `fix-failures`. Never weaken the assertion to force green.

5. **Frappe safety:** only run against a site with `allow_tests` enabled; otherwise write the test
   and leave a note.

6. **Leave for review.** Do NOT commit. Print the test added and its result. Tell the user to review
   `git diff` and commit.

## Rules

- One described behaviour → one focused, correctly-named test that asserts the exact expectation.
- Confirm an ambiguous input/expectation with a single question rather than guessing.
- Additive only; reuse factories/masters; never create heavyweight records.
- If the app disagrees with the described expectation, that's a bug to report (→ `fix-failures`),
  not a reason to weaken the test. Never auto-commit.
