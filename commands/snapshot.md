---
description: Set up snapshot / golden tests for output-heavy code so you don't hand-write assertions (review the baseline before trusting it)
argument-hint: "[path-or-stack | target]"
---

Set up snapshot tests using the snapshot workflow.

1. Determine scope from `$ARGUMENTS`: a path/stack/target narrows it; empty → discover
   output-producing units (serializers, to_dict/as_dict, report builders, API handlers, render
   functions) and confirm the list.

2. Follow the `snapshot` skill: use the stack's native mechanism — jest `toMatchSnapshot`
   (Electron/Next.js), `matchesGoldenFile` or a serialized golden (Flutter), canonical-JSON golden
   files (Frappe/Supabase). NORMALIZE non-determinism (timestamps, ids, ordering) first so snapshots
   fail only on real changes.

3. Generate the baseline from CURRENT output, then SHOW it to the user and have them confirm it's
   correct before trusting it (a snapshot of a buggy output would lock the bug in). Run green.

4. Frappe: only run against a site with `allow_tests` enabled.

5. Do NOT commit. Report the snapshots created and what was normalized; remind the user the
   baselines are now the source of truth. Tell them to review the `git diff` and commit.
