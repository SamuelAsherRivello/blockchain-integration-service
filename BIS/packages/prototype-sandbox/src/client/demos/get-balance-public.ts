
//////////////////////////////////////////
// Arrange
//////////////////////////////////////////
import {
  demoResult,
  type DemoContext,
  demoTransactionDetails,
  demoGetInput,
  demoGetVtxosUrl,
  type DemoHistoryEntry,
} from '../sandbox-shared.ts';
import { ArkAddress } from '@arkade-os/sdk';

export async function runDemo({ network }: DemoContext) {
  const currentAddress = demoGetInput(network, 'wallet-1-address');

  //////////////////////////////////////////
  // Act
  //////////////////////////////////////////
  const allResponse = await fetch(demoGetVtxosUrl(network, ArkAddress.decode(currentAddress)));
  const availableResponse = await fetch(`${demoGetVtxosUrl(network, ArkAddress.decode(currentAddress))}&spendableOnly=true`);
  const allResult = await allResponse.json();
  const availableResult = await availableResponse.json();
  if (!allResponse.ok || !availableResponse.ok)
    throw new Error(allResult.message || availableResult.message || 'The balance request failed.');
  const allVtxos: DemoHistoryEntry[] = allResult.vtxos ?? [];
  const availableVtxos: DemoHistoryEntry[] = availableResult.vtxos ?? [];
  const totalSats = allVtxos.reduce((total, vtxo) => total + Number(vtxo.amount ?? 0), 0);
  const availableSats = availableVtxos.reduce((total, vtxo) => total + Number(vtxo.amount ?? 0), 0);

  //////////////////////////////////////////
  // Assert
  //////////////////////////////////////////
  return demoResult([
    `Address: ${currentAddress}`,
    `Available: ${availableSats} sats`,
    `Total: ${totalSats} sats`,
    `VTXOs: ${availableVtxos.length}`,
    `Success: ${allResponse.ok && availableResponse.ok}`,
  ].join('\n'), demoTransactionDetails(network, allVtxos));
}
