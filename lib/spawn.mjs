import { spawn } from 'node:child_process';

// Async spawn that returns a spawnSync-like shape: { status, stdout, stderr, error }.
// Never rejects — a spawn failure resolves with { error }.
export function spawnAsync(command, args = [], opts = {}) {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(command, args, { cwd: opts.cwd, env: opts.env || process.env });
    } catch (error) {
      resolve({ status: null, stdout: '', stderr: '', error });
      return;
    }
    let stdout = '';
    let stderr = '';
    let settled = false;
    const done = (r) => { if (!settled) { settled = true; resolve(r); } };
    if (child.stdout) child.stdout.on('data', (d) => { stdout += d.toString('utf8'); });
    if (child.stderr) child.stderr.on('data', (d) => { stderr += d.toString('utf8'); });
    child.on('error', (error) => done({ status: null, stdout, stderr, error }));
    child.on('close', (code) => done({ status: code, stdout, stderr, error: null }));
  });
}
