// Read-only recovery for a settled Arkade operation whose intent did not record its fee.
import { RestIndexerProvider, Transaction } from '@arkade-os/sdk';
import { base64, hex } from '@scure/base';
import { Vault } from './test-wallets/vault.ts';
import { Operations } from './test-wallets/operations.ts';

for (const method of ['log', 'info', 'warn', 'error', 'debug', 'trace', 'dir']) console[method] = () => {};
const [id, ...extra] = process.argv.slice(2);
const safeInteger = value => Number.isSafeInteger(value) && value >= 0;
function parse(encoded: string) {
  return /^[a-f0-9]+$/i.test(encoded) ? Transaction.fromRaw(hex.decode(encoded)) : Transaction.fromPSBT(base64.decode(encoded));
}
async function readOne(indexer: RestIndexerProvider, txid: string) {
  const response = await indexer.getVirtualTxs([txid]);
  const tx = response.txs.map(parse).find(value => value.id === txid);
  if (!tx) throw Error('fee-transaction-unavailable');
  return tx;
}
try {
  if (extra.length || !/^[A-Za-z0-9:_-]{1,300}$/.test(id ?? '')) throw Error('invalid-arguments');
  const vault = new Vault(), ledger = new Operations(vault);
  const operation = await vault.transaction(state => (state.operations ?? []).find(row => row.intent.id === id));
  if (!operation || operation.state !== 'settled' || !operation.providerId || !['signet', 'mutinynet'].includes(operation.intent.network))
    throw Error('fee-reconciliation-unavailable');
  if (operation.observedFeeSats !== undefined) {
    process.stdout.write(JSON.stringify({ ok: true, reconciled: false, alreadyVerified: true, feeSats: operation.observedFeeSats }) + '\n');
  } else {
    const indexer = new RestIndexerProvider(`https://${operation.intent.network}.arkade.sh`);
    const result = await ledger.reconcileObservedFee(id, async saved => {
      const tx = await readOne(indexer, saved.providerId);
      const inputs = Array.from({ length: tx.inputsLength }, (_, index) => {
        const input = tx.getInput(index);
        if (!input.txid || !safeInteger(input.index)) throw Error('fee-input-unavailable');
        return { txid: hex.encode(input.txid), vout: input.index };
      });
      if (!inputs.length || new Set(inputs.map(input => `${input.txid}:${input.vout}`)).size !== inputs.length)
        throw Error('fee-input-unavailable');
      const parents = await Promise.all([...new Set(inputs.map(input => input.txid))].map(txid => readOne(indexer, txid)));
      const inputSats = inputs.reduce((sum, input) => {
        const parent = parents.find(value => value.id === input.txid);
        if (!parent || input.vout >= parent.outputsLength) throw Error('fee-input-unavailable');
        const amount = Number(parent.getOutput(input.vout).amount);
        if (!safeInteger(amount) || !safeInteger(sum + amount)) throw Error('fee-input-unavailable');
        return sum + amount;
      }, 0);
      const outputSats = Array.from({ length: tx.outputsLength }, (_, index) => Number(tx.getOutput(index).amount))
        .reduce((sum, amount) => safeInteger(amount) && safeInteger(sum + amount) ? sum + amount : NaN, 0);
      const feeSats = inputSats - outputSats;
      if (tx.id !== saved.providerId || !safeInteger(outputSats) || !safeInteger(feeSats)) throw Error('fee-transaction-invalid');
      return { id, fingerprint: saved.fingerprint, providerId: saved.providerId, outcome: 'settled', verified: true,
        inputSats, outputSats, feeSats };
    });
    if (result.observedFeeSats === undefined) throw Error('fee-reconciliation-unavailable');
    process.stdout.write(JSON.stringify({ ok: true, reconciled: true, feeSats: result.observedFeeSats,
      transactionVerified: result.feeEvidence?.transactionId === result.providerId }) + '\n');
  }
} catch (error) {
  const reason = /^fee-[a-z-]+$/.test(error?.message ?? '') || error?.message === 'invalid-arguments' ? error.message : 'fee-reconciliation-unavailable';
  process.stdout.write(JSON.stringify({ ok: false, reason }) + '\n');
  process.exitCode = 1;
}
