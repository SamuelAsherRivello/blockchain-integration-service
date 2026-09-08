import test from 'node:test';
import assert from 'node:assert/strict';
import { transactionRowPresentation } from '../src/core/activity.ts';

test('activity rows consistently present operation, sats, network and primary identifier', () => {
  const base = {id:'fixture', amountSats:1000, direction:'Outgoing', status:'Settled offchain', identifier:'ark:abc'};
  for (const [extra, heading, network] of [
    [{}, 'Send Balance · 1,000 sats', 'Off-chain'],
    [{direction:'Incoming'}, 'Receive Balance · 1,000 sats', 'Off-chain'],
    [{kind:'Asset mint', amountSats:0}, 'Mint Asset · 0 sats', 'Off-chain'],
    [{direction:'Mint', satsUnknown:true}, 'Mint Asset · Sats unknown', 'Off-chain'],
    [{kind:'Asset transfer'}, 'Send Asset · 1,000 sats', 'Off-chain'],
    [{kind:'Asset transfer', direction:'Incoming'}, 'Receive Asset · 1,000 sats', 'Off-chain'],
    [{bitcoin:{txid:'a'.repeat(64)}}, 'Send Balance · 1,000 sats', 'On-chain'],
    [{direction:'Bitcoin → Arkade'}, 'Transfer to Arkade · 1,000 sats', 'On-chain → Off-chain'],
    [{transfer:{direction:'to-bitcoin'}}, 'Transfer to Bitcoin · 1,000 sats', 'Off-chain → On-chain'],
  ]) {
    const actual = transactionRowPresentation({...base, ...extra});
    assert.equal(actual.heading, heading);
    assert.equal(actual.network, network);
  }
  assert.equal(transactionRowPresentation({...base, identifier:'ark:abc mint-operation:local'}).identifier, 'ark:abc');
  assert.equal(transactionRowPresentation({...base, identifier:'a'.repeat(64)+':0'}).identifier, 'bitcoin:'+'a'.repeat(64)+':0');
  assert.equal(transactionRowPresentation({...base, status:'Status unavailable', identifier:'Identifier unavailable'}).network, 'Network unavailable');
});
