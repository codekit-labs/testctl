import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';

export function loadConfig(projectDir) {
  const path = join(projectDir, 'testctl.yaml');
  if (!existsSync(path)) return { stacks: {} };
  let parsed;
  try {
    parsed = parse(readFileSync(path, 'utf8'));
  } catch (e) {
    throw new Error(`Failed to parse testctl.yaml: ${e.message}`);
  }
  if (!parsed || typeof parsed !== 'object') return { stacks: {} };
  return { stacks: parsed.stacks || {} };
}
