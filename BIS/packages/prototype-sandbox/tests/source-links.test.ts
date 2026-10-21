import assert from 'node:assert/strict';
import test from 'node:test';
import { demoSourceFile, demoSourceUrl, SOURCE_FILES } from '../src/client/source-links.ts';

test('source links choose readable local Vite files or GitHub source by build mode', () => {
  for (const sourceId of ['create-wallet-source', 'send-payment-source', 'events-source', 'asset-upgrade-source', 'conditional-vault-create-source', 'conditional-vault-check-source']) {
    const path = demoSourceFile(sourceId);
    assert.ok(Object.values(SOURCE_FILES).includes(path));
    const local = new URL(demoSourceUrl(sourceId, true), 'http://127.0.0.1:5174');
    assert.equal(local.pathname, '/prototype-sandbox/source-view/');
    assert.equal(local.searchParams.get('file'), path);
    assert.equal(demoSourceUrl(sourceId, false), `https://github.com/SamuelAsherRivello/blockchain-integration-service/blob/main/${path}`);
  }
});
