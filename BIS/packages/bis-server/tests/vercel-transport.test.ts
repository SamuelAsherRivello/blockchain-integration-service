import test from 'node:test';
import assert from 'node:assert/strict';
import { vercelCurlConfig } from '../scripts/vercel-curl-config.ts';

test('refreshed acceptance grants replace case-insensitive headers without duplicate bearer values', () => {
  const config = vercelCurlConfig({ method: 'signMessage' }, { authorization: 'Bearer fixture-owner', 'x-bis-signing-grant': 'old-grant', 'X-BIS-Signing-Grant': 'fresh-grant' });
  assert.equal(config.includes('old-grant'), false);
  assert.equal((config.match(/x-bis-signing-grant/g) ?? []).length, 1);
  assert.ok(config.includes('fresh-grant'));
  assert.ok(config.includes('authorization: Bearer fixture-owner'));
  assert.ok(config.startsWith('request = "POST"'));
});

test('acceptance curl config escapes payloads and rejects header-name injection', () => {
  const config = vercelCurlConfig({ text: 'line\n"quoted"' }, { Authorization: 'fixture\nurl = "https://untrusted.test"' });
  assert.equal(config.split('\n').filter(line => line.startsWith('url')).length, 0);
  assert.equal(config.split('\n').filter(line => line.startsWith('data-raw')).length, 1);
  assert.throws(() => vercelCurlConfig({}, { 'bad\nheader': 'value' }), /Invalid/);
  assert.ok(vercelCurlConfig().startsWith('request = "GET"'));
});
