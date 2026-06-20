// Bundles the engine (bin + lib, with the yaml/fast-xml-parser deps inlined) into a single
// dependency-free file at dist/testctl.mjs, so the Claude Code plugin runs after a plain
// `git clone` with no `npm install` and no network.
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkgVersion = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;

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

// Second artifact: the MCP server, with the @modelcontextprotocol/sdk + zod bundled in. SEPARATE from
// dist/testctl.cjs (which stays dependency-free and unchanged). CJS for the same dynamic-require reason.
// TESTCTL_MCP_BUNDLE is a compile-time constant: esbuild replaces every reference to it with `true`,
// which the entry guard in cli.mjs checks to skip main() when cli.mjs is bundled as a library here.
await build({
  entryPoints: [join(root, 'bin', 'testctl-mcp.mjs')],
  outfile: join(root, 'dist', 'testctl-mcp.cjs'),
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  define: { TESTCTL_MCP_BUNDLE: 'true', TESTCTL_MCP_VERSION: JSON.stringify(pkgVersion) },
});
console.log('built dist/testctl-mcp.cjs');
