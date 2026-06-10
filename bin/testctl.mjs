#!/usr/bin/env node
// Public entry point. This is a tiny launcher that runs the BUNDLED, dependency-free
// engine (dist/testctl.cjs) — NOT the raw source (bin/cli.mjs), which imports npm deps
// (yaml, fast-xml-parser) that are NOT installed in a plugin clone / git checkout.
//
// Why: the plugin ships as a git clone with no node_modules. Running the source entry
// directly (node bin/cli.mjs) would crash with ERR_MODULE_NOT_FOUND. The bundle has every
// dependency inlined, so importing it here always works. argv is passed through untouched
// (the engine parses process.argv[2..]), so `node bin/testctl.mjs run --changed` behaves
// exactly as if the engine were invoked directly.
//
// Dev note: `npm run build` bundles bin/cli.mjs -> dist/testctl.cjs.
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const engineUrl = new URL('../dist/testctl.cjs', import.meta.url);

if (!existsSync(fileURLToPath(engineUrl))) {
  console.error(
    'testctl: bundled engine dist/testctl.cjs is missing. Run `npm run build` from the testctl repo.'
  );
  process.exit(1);
}

await import(engineUrl);
