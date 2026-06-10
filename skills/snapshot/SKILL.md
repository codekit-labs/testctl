---
name: snapshot
description: Set up snapshot / golden tests for output-heavy code (serializers, reports, API responses, rendered widgets) so you don't hand-write assertions — across Flutter (golden), Electron/Next.js (jest snapshots), Frappe/Supabase (serialized golden output). Use when the user runs /testctl:snapshot, or says "snapshot test", "golden test", "approval test", "capture the current output", or wants to guard complex output without writing expects.
---

# snapshot

For code whose value is its **output** — a serialized dict, a report, an API response, a rendered
widget — hand-writing assertions is painful and brittle. This skill sets up **snapshot/golden
tests**: it captures the *current* output as a saved baseline and the test thereafter asserts "still
matches". One command, zero hand-written `expect`s. Additive. Read
`../generate-tests/stack-conventions.md`.

## Inputs

`/testctl:snapshot [path-or-stack | target]`: a path/stack narrows scope; a named function/endpoint/
widget targets one output. Empty → find output-producing units (serializers, `to_dict`/`as_dict`,
report builders, API handlers, pure render functions) and confirm the list.

## Steps

1. **Pick snapshot-worthy outputs.** Identify units that return a stable, serializable result or a
   renderable widget. Skip outputs full of non-determinism (timestamps, random ids, ordering) unless
   they can be normalized — see step 3.

2. **Use the stack's native mechanism:**
   - **Electron/Next.js (jest):** `expect(result).toMatchSnapshot()` (or `toMatchInlineSnapshot`).
   - **Flutter:** `matchesGoldenFile` for widgets, or snapshot a serialized model
     (`expect(json.encode(x), matchesGoldenSnapshot)` pattern) for data.
   - **Frappe/Supabase:** serialize the output to canonical JSON and compare against a committed
     golden file (write the golden on first run).

3. **Normalize non-determinism BEFORE snapshotting** — strip/replace timestamps, ids, and sort
   unordered collections — so the snapshot is stable and a real change (not noise) is what fails.

4. **Generate the baseline from CURRENT output, then REVIEW it.** Snapshots capture whatever the
   code does today — so a snapshot of a buggy output would lock the bug in. After generating, show
   the user the captured snapshot(s) and have them confirm the output is actually correct before
   trusting it. Run the suite green.

5. **Frappe safety:** only run against a site with `allow_tests` enabled.

6. **Leave for review.** Do NOT commit. Report the snapshots created, what was normalized, and
   remind the user to review the captured baselines (they're now the source of truth). Tell them to
   review `git diff` and commit.

## Rules

- A snapshot encodes CURRENT behaviour — always have the user confirm the baseline is correct, never
  blindly trust a freshly-captured snapshot.
- Normalize non-deterministic fields so snapshots fail only on real changes.
- Additive; never overwrite existing tests. Verify the suite is green. Never auto-commit.
