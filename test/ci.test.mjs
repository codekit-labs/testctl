import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildWorkflowYaml } from '../lib/ci.mjs';

test('buildWorkflowYaml includes the key CI steps', () => {
  const y = buildWorkflowYaml();
  assert.match(y, /actions\/checkout@v4/);
  assert.match(y, /actions\/setup-node@v4/);
  assert.match(y, /curl -fsSL https:\/\/raw\.githubusercontent\.com\/codekit-labs\/testctl\/main\/dist\/testctl\.cjs -o testctl\.cjs/);
  assert.match(y, /node testctl\.cjs run --quiet --report-junit=testctl-junit\.xml/);
  assert.match(y, /actions\/upload-artifact@v4/);
});

import { buildGitlabYaml } from '../lib/ci.mjs';

test('buildGitlabYaml fetches the engine, runs it, and exposes junit', () => {
  const y = buildGitlabYaml();
  assert.match(y, /curl -fsSL https:\/\/raw\.githubusercontent\.com\/codekit-labs\/testctl\/main\/dist\/testctl\.cjs -o testctl\.cjs/);
  assert.match(y, /node testctl\.cjs run --quiet --report-junit=testctl-junit\.xml/);
  assert.match(y, /junit: testctl-junit\.xml/);
});
