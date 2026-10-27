// Arrange
import { demoResult, type DemoContext, demoTransactionDetails } from '../demo-runtime.ts';
import { demoGetInput } from '../navigation.ts';
import { demoGetVtxosUrl } from '../demo-utils.ts';

import type { DemoHistoryEntry } from '../demo-runtime.ts';

export async function runDemo({ network }: DemoContext) {
  const currentAddress = demoGetInput(network, 'wallet-1-address');

  // Act
  const allResponse = await fetch(demoGetVtxosUrl(network, currentAddress));
  const availableResponse = await fetch(`${demoGetVtxosUrl(network, currentAddress)}&spendableOnly=true`);
  const allResult = await allResponse.json();
  const availableResult = await availableResponse.json();
  if (!allResponse.ok || !availableResponse.ok)
    throw new Error(allResult.message || availableResult.message || 'The balance request failed.');
  const allVtxos: DemoHistoryEntry[] = allResult.vtxos ?? [];
  const availableVtxos: DemoHistoryEntry[] = availableResult.vtxos ?? [];
  const totalSats = allVtxos.reduce((total, vtxo) => total + Number(vtxo.amount ?? 0), 0);
  const availableSats = availableVtxos.reduce((total, vtxo) => total + Number(vtxo.amount ?? 0), 0);

  // Assert
  return demoResult([
    `Address: ${currentAddress}`,
    `Available: ${availableSats} sats`,
    `Total: ${totalSats} sats`,
    `VTXOs: ${availableVtxos.length}`,
    `Success: ${allResponse.ok && availableResponse.ok}`,
  ].join('\n'), demoTransactionDetails(network, allVtxos));
}
