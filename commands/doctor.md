---
description: Check this machine's testctl readiness — Node version + which stack tools are installed
---

Run the bundled engine's health check and present the result:

`node "${CLAUDE_PLUGIN_ROOT}/dist/testctl.cjs" doctor`

It prints a ✓/⊘ checklist (Node ≥ 20, plus flutter / bench / supabase) and the "Ready stacks"
line. If Node is below 20 or a stack tool the user needs is missing, tell them what to install
(e.g. install Flutter for Flutter tests, the Frappe bench for Frappe). Electron/Next.js use the
project's own jest/vitest via npx, so no global tool is required for those.
