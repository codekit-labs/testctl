// Bundles the engine (bin + lib, with the yaml/fast-xml-parser deps inlined) into a single
// dependency-free file at dist/testctl.mjs, so the Claude Code plugin runs after a plain
// `git clone` with no `npm install` and no network.
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// Output CJS (not ESM): the engine's deps (yaml, fast-xml-parser) are CommonJS and use
// dynamic require() of Node built-ins, which is unsupported in an ESM bundle. A CJS bundle
// handles require() natively and still runs under Node with no node_modules.
await build({
  entryPoints: [join(root, 'bin', 'cli.mjs')],
  outfile: join(root, 'dist', 'testctl.cjs'),
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
});

console.log('built dist/testctl.cjs');
