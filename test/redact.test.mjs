import { test } from 'node:test';
import assert from 'node:assert/strict';
import { redactPII, redactNotifyPayload } from '../lib/redact.mjs';

test('redactPII masks emails and long digit runs, keeps small numbers', () => {
  assert.equal(redactPII('contact jo.doe@acme.co now'), 'contact [email] now');
  assert.equal(redactPII('call +966 50 123 4567 please'), 'call [number] please');
  assert.equal(redactPII('card 4111 1111 1111 1111'), 'card [number]');
  assert.equal(redactPII('expected 2 got 3 on line 42'), 'expected 2 got 3 on line 42'); // untouched
  assert.equal(redactPII(null), null);
});

test('redactNotifyPayload redacts text and failed[].error, non-mutating', () => {
  const p = { text: 'fail for bob@x.com', project: 'p', totals: {}, failed: [{ app: 'a', error: 'duplicate +12025550173' }] };
  const out = redactNotifyPayload(p);
  assert.match(out.text, /\[email\]/);
  assert.match(out.failed[0].error, /\[number\]/);
  assert.equal(p.text, 'fail for bob@x.com'); // original untouched
});
