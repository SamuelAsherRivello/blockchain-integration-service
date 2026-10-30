
//////////////////////////////////////////
// Arrange
//////////////////////////////////////////
import {
  demoResult,
  demoDisposeWallet,
  type DemoContext,
  demoGetInput,
  demoCreateWallet,
  demoGetMnemonic,
} from '../sandbox-shared.ts';
import { MnemonicIdentity } from '@arkade-os/sdk';

export async function runDemo({ network }: DemoContext) {
  const address1 = demoGetInput(network, 'wallet-1-address');
  const amountSats = 100;
  let wallet;

  //////////////////////////////////////////
  // Act
  //////////////////////////////////////////
  try {
    wallet = await demoCreateWallet(network, { identity: MnemonicIdentity.fromMnemonic(demoGetMnemonic(network), { isMainnet: false }) });

    // Notice that the selected amount is passed straight to the real SDK send.
    const txid = await wallet.send({ address: address1, amount: amountSats });

    //////////////////////////////////////////
    // Assert
    //////////////////////////////////////////

    // The output pairs that amount with the transaction ID returned by the SDK.
    return demoResult([`Amount sent: ${amountSats} sats`, `Transaction ID: ${txid}`, `Success: ${Boolean(txid)}`].join('\n'), { explorer: { network, kind: 'ark-transaction', identifier: txid } });
  }
  finally {
    await demoDisposeWallet(wallet);
  }
}
