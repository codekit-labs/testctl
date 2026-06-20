#!/usr/bin/env node
// testctl MCP server — exposes the engine over the Model Context Protocol (stdio) so ANY MCP client
// (Cursor, Windsurf, Cline, Claude Desktop, custom agents, CI bots) can run tests and get structured
// results. Read/data tools only; the calling agent does any fixing. The SDK + zod are bundled into
// dist/testctl-mcp.cjs by scripts/build.mjs, so this runs with no `npm install`.
//
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { runProject, buildContextApps, STACKS } from './cli.mjs';
import { loadLastRun, saveLastRun } from '../lib/lastrun.mjs';
import { buildRunResponse, buildDigestResponse, buildContextResponse } from '../lib/mcp.mjs';

// projectDir = the project under test: explicit env override, else the server's CWD.
const projectDir = process.env.TESTCTL_PROJECT_DIR || process.cwd();

const server = new McpServer({ name: 'testctl', version: '1.57.0' });

const ok = (obj) => ({ content: [{ type: 'text', text: JSON.stringify(obj) }], structuredContent: obj });

server.registerTool(
  'testctl_run',
  {
    title: 'Run tests',
    description: 'Discover and run the project\'s tests (Frappe/Flutter/Electron/Next.js/Supabase/Web/E2E) and return structured results, failures, and exit code. Optionally scope to a stack/path or to changed files, and request coverage.',
    inputSchema: {
      stack: z.enum(STACKS).optional(),
      path: z.string().optional(),
      changed: z.boolean().optional(),
      coverage: z.boolean().optional(),
    },
  },
  async ({ stack, path, changed, coverage }) => {
    const core = await runProject(projectDir, {
      only: stack || null,
      coverage: !!coverage,
      changed: changed ? { ref: null } : null,
    });
    try { saveLastRun(projectDir, core.results, new Date().toISOString()); } catch { /* best-effort */ }
    return ok(buildRunResponse(core));
  },
);

server.registerTool(
  'testctl_digest',
  {
    title: 'Last-run digest',
    description: 'Recall the last test run\'s failure digest from .testctl/last-run.json WITHOUT re-running. Returns hasRun, results, failures, and a human text summary.',
    inputSchema: {},
  },
  async () => ok(buildDigestResponse(loadLastRun(projectDir))),
);

server.registerTool(
  'testctl_context',
  {
    title: 'Project test context',
    description: 'Per-app situational digest: which apps have tests, status, coverage, untested symbols, and the recommended action (generate/fix/boost/harden/ok). Read-only; does not run tests.',
    inputSchema: { stack: z.enum(STACKS).optional() },
  },
  async ({ stack }) => ok(buildContextResponse(buildContextApps(projectDir, stack || null))),
);

// Top-level await is not supported in CJS bundles (esbuild cjs output); wrap in async IIFE
// so this file works both as raw ESM source AND as the bundled dist/testctl-mcp.cjs.
(async () => {
  await server.connect(new StdioServerTransport());
})();
