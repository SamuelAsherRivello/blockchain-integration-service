import assert from 'node:assert/strict';
import test from 'node:test';
import { demoExplorerUrl, demoSupportsExplorer, firstArkTransaction } from '../src/client/demo-explorer.ts';

for (const network of ['signet', 'mutinynet'] as const) {
  test(`${network}: explorer buttons use validated structured references and the result network`, () => {
    const id = 'ab'.repeat(32);
    assert.equal(demoSupportsExplorer(`${network}:1`), false);
    for (let demo = 2; demo <= 19; demo++) assert.equal(demoSupportsExplorer(`${network}:${demo}`), true);
    assert.equal(demoExplorerUrl(`${network}:14`), undefined);
    assert.equal(demoExplorerUrl(`${network}:14`, { network, kind: 'ark-transaction', identifier: id }), `https://explorer.${network}.arkade.sh/tx/${id}`);
    assert.equal(demoExplorerUrl(`${network}:7`, { network, kind: 'asset', identifier: `${id}0000` }), `https://explorer.${network}.arkade.sh/asset/${id}0000`);
    const bitcoin = demoExplorerUrl(`${network}:19`, { network, kind: 'bitcoin-transaction', identifier: id });
    assert.equal(bitcoin, `${network === 'signet' ? 'https://mempool.space/signet' : 'https://mempool.mutinynet.arkade.sh'}/tx/${id}`);
    assert.equal(demoExplorerUrl(`${network}:14`, { network: network === 'signet' ? 'mutinynet' : 'signet', kind: 'ark-transaction', identifier: id }), undefined);
    for (const identifier of ['', '0000', 'javascript:alert(1)', `Error: ${id}`]) assert.equal(demoExplorerUrl(`${network}:14`, { network, kind: 'ark-transaction', identifier }), undefined);
    assert.equal(firstArkTransaction([{ txid: 'invalid' }, { key: { arkTxid: id } }]), id);
    assert.equal(firstArkTransaction([]), undefined);
  });
}
