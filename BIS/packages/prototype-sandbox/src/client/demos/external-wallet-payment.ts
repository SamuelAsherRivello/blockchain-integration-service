
//////////////////////////////////////////
// Arrange
//////////////////////////////////////////
import {
  demoGetInput,
  demoExternalWalletPayment,
  demoResult,
  type DemoContext,
  type DemoResult,
} from '../sandbox-shared.ts';

export async function runDemo({ network, amount = '100', externalWalletWindow }: DemoContext): Promise<DemoResult> {
  const recipientAddress = demoGetInput(network, 'wallet-1-address');

  //////////////////////////////////////////
  // Act
  //////////////////////////////////////////

  // This opens a real approval request for Wallet 1 with the entered amount.
  const txid = await demoExternalWalletPayment({ network, recipientAddress, amountSats: amount, walletWindow: externalWalletWindow });

  //////////////////////////////////////////
  // Assert
  //////////////////////////////////////////

  // Show the wallet's actual callback transaction ID; a handoff alone is not success.
  return demoResult([`Requested amount: ${amount} sats`, `Transaction ID: ${txid}`, `Success: ${Boolean(txid)}`].join('\n'), { explorer: { network, kind: 'ark-transaction', identifier: txid } });
}
