
//////////////////////////////////////////
// Arrange
//////////////////////////////////////////
import {
  validateArkadeAddress,
  walletConnectUrl,
  walletCallbackUrl,
  demoGetNetwork,
  demoWithFreshWallet,
  demoResult,
  type DemoContext,
  type DemoResult,
} from '../sandbox-shared.ts';
import { RestArkProvider } from '@arkade-os/sdk';

export function externalWalletAddressResult(search: string) {
  const result = new URLSearchParams(search);
  if (result.has('error'))
    return { error: result.get('error') || 'denied' };
  return { address: result.get('address') || '' };
}
export async function runDemo({ network, externalAddress }: DemoContext): Promise<DemoResult> {

  //////////////////////////////////////////
  // Act
  //////////////////////////////////////////
  if (!externalAddress) {
    const link = walletConnectUrl({ network, callback: walletCallbackUrl(window.location.href) });
    const popup = window.open(link, '_blank', 'popup,width=480,height=840,resizable=yes,scrollbars=yes');
    if (!popup)
      window.location.assign(link);
    return { output: '', pending: true };
  }
  // The page calls this same entry point when the external wallet supplies its address.
  const provider = new RestArkProvider(demoGetNetwork(network).operator);
  const info = await provider.getInfo();
  validateArkadeAddress(externalAddress, info, network);
  const txid = await demoWithFreshWallet(network, wallet => wallet.send({ address: externalAddress, amount: 100 }));

  //////////////////////////////////////////
  // Assert
  //////////////////////////////////////////
  return demoResult([`External wallet address: ${externalAddress}`, `Transaction ID: ${txid}`, `Success: ${Boolean(txid)}`].join('\n'), {
    explorer: { network, kind: 'ark-transaction', identifier: txid },
  });
}
