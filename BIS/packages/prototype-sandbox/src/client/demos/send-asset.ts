
//////////////////////////////////////////
// Arrange
//////////////////////////////////////////
import {
  demoResult,
  demoDisposeWallet,
  type DemoContext,
  getMintedAssetId,
  demoGetInput,
  assetPaymentSats,
  demoValidateAssetTransferSats,
  assetSendIndexerError,
  demoCreateWallet,
  demoGetMnemonic,
} from '../sandbox-shared.ts';
import { MnemonicIdentity } from '@arkade-os/sdk';

export async function runDemo({ network }: DemoContext) {
  const address1 = demoGetInput(network, 'wallet-1-address');
  const assetId = demoGetInput(network, 'asset-id') || '0000';
  const paymentSats = demoGetInput(network, 'asset-payment-sats');
  const actualAssetId = getMintedAssetId(network, assetId);
  let wallet;
  let sendStarted = false;

  //////////////////////////////////////////
  // Act
  //////////////////////////////////////////
  try {
    const amount = demoValidateAssetTransferSats(assetPaymentSats(paymentSats));
    if (!actualAssetId)
      throw new Error('Use Mint Asset demo first.');
    wallet = await demoCreateWallet(network, { identity: MnemonicIdentity.fromMnemonic(demoGetMnemonic(network), { isMainnet: false }) });
    sendStarted = true;
    const txid = await wallet.send({ address: address1, amount, assets: [{ assetId: actualAssetId, amount: 1n }] });

    //////////////////////////////////////////
    // Assert
    //////////////////////////////////////////
    return demoResult([`Transaction ID: ${txid}`, `Asset units: 1`, `Total sent: ${amount} sats and 1 asset unit`, `Success: ${Boolean(txid)}`].join('\n'), { explorer: { network, kind: 'ark-transaction', identifier: txid } });
  }
  catch (error) {
    throw assetSendIndexerError(error, sendStarted) ?? error;
  }
  finally {
    await demoDisposeWallet(wallet);
  }
}
