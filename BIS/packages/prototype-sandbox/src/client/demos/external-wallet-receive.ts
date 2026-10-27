// Arrange
import { RestArkProvider } from '@arkade-os/sdk';
import { validateArkadeAddress } from '../../../../prototype-faucet/src/shared/faucet-core.ts';
import { walletConnectUrl, walletCallbackUrl } from '../navigation.ts';
import { demoGetNetwork } from '../demo-utils.ts';
import { demoWithFreshWallet } from '../demo-wallet.ts';
import { demoResult, type DemoContext, type DemoResult } from '../demo-runtime.ts';

export async function runDemo({ network, externalAddress }: DemoContext): Promise<DemoResult> {

  // Act
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

  // Assert
  return demoResult([`External wallet address: ${externalAddress}`, `Transaction ID: ${txid}`, `Success: ${Boolean(txid)}`].join('\n'), {
    explorer: { network, kind: 'ark-transaction', identifier: txid },
  });
}
