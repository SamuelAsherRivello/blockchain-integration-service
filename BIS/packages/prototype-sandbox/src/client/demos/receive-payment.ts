
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
  const address1 = demoGetInput(network, 'wallet-1-address');

  //////////////////////////////////////////
  // Act
  //////////////////////////////////////////
  const response = await fetch(`${demoGetVtxosUrl(network, ArkAddress.decode(address1))}&spendableOnly=true`);
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.message || 'The receive request failed.');
  const vtxos: DemoHistoryEntry[] = result.vtxos ?? [];
  if (vtxos.length === 0)
    throw new Error('Use Send Payment demo first.');
  const total = vtxos.reduce((sum, vtxo) => sum + Number(vtxo.amount ?? 0), 0);

  //////////////////////////////////////////
  // Assert
  //////////////////////////////////////////
  return demoResult([`Address: ${address1}`, `Total: ${total} sats`, `VTXOs: ${vtxos.length}`, `Success: ${response.ok}`].join('\n'), demoTransactionDetails(network, vtxos));
}
