---
description: Generate tests protecting against performance regressions — deterministic no-N+1 (expensive-call count must not grow with input size), by discovering the project's own hot paths
argument-hint: "[path-or-stack]"
---

Guard performance against regressions using the perf-guard workflow.

1. Determine scope from `$ARGUMENTS`: a path/stack narrows it; empty → discover the hot paths
   (list/report endpoints, loops over records, code from `--changed`/`context`) and confirm the list.

2. Discover hot paths: `node "${CLAUDE_PLUGIN_ROOT}/dist/testctl.cjs" run --changed --quiet` and read
   `TESTCTL_JSON`; look for operations whose cost scales with data (a query/HTTP call per row).

3. Follow the `perf-guard` skill: for each hot path write a NEW test (reusing existing masters, never
   heavy creates) that instruments the expensive collaborator to COUNT its calls, runs the operation
   over n1 and a larger n2 record set, and asserts the count does NOT scale with N (constant or
   fixed-bounded) — an N+1 fails it. What to count: Frappe = `frappe.db.sql`/`get_value` calls;
   Next.js/Supabase/Node = ORM/client query hook; Flutter/Electron = outbound HTTP/repository calls via
   a spy. Deterministic counts only — add a wall-clock budget ONLY if the user asks, flagged as
   environment-sensitive.

4. Run to green. A real regression (N+1 / unbounded query count) → report it (skip with a reason) for
   the user; never optimize app code here and never weaken an assertion (e.g. raise the budget K) to
   force green.

5. Frappe: only run against a site with `allow_tests` enabled.

6. Do NOT commit. Report the hot paths covered, the call-count invariants asserted, and any regression
   surfaced. Tell the user to review the `git diff` and commit.
