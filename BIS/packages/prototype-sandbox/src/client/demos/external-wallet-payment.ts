// Arrange
import { RestArkProvider } from '@arkade-os/sdk';
import { validateArkadeAddress } from '../../../../prototype-faucet/src/shared/faucet-core.ts';
import { demoGetInput, walletPaymentUrl, walletCallbackUrl } from '../navigation.ts';
import { demoGetNetwork } from '../demo-utils.ts';
import type { DemoContext, DemoResult } from '../demo-runtime.ts';

export async function runDemo({ network, amount = '100' }: DemoContext): Promise<DemoResult> {
  const address = demoGetInput(network, 'wallet-1-address');

  // Act
  const provider = new RestArkProvider(demoGetNetwork(network).operator);
  const info = await provider.getInfo();
  validateArkadeAddress(address, info, network);
  const link = walletPaymentUrl({ network, address, amountSats: amount, callback: walletCallbackUrl(window.location.href) });
  const popup = window.open(link, '_blank', 'popup,width=480,height=840,resizable=yes,scrollbars=yes');
  if (!popup)
    window.location.assign(link);

  // Assert
  // Opening a wallet is not a completed payment. Its callback supplies the result.
  return { output: '', pending: true };
}
