// Arrange
import { demoResult, demoDisposeWallet, type DemoContext } from '../demo-runtime.ts';
import { getMintedAssetId } from '../demo-asset-selection.ts';
import { demoGetInput } from '../navigation.ts';
import { optionalAssetPayment, assetTransferSats, assetSendIndexerError } from '../asset-payment.ts';
import { demoCreateWallet } from '../demo-wallet.ts';

export async function runDemo({ network }: DemoContext) {
  const address1 = demoGetInput(network, 'wallet-1-address');
  const assetId = demoGetInput(network, 'asset-id') || '0000';
  const paymentSats = optionalAssetPayment(demoGetInput(network, 'asset-payment-sats'));
  const actualAssetId = getMintedAssetId(network, assetId);
  let wallet;
  let sendStarted = false;

  // Act
  try {
    if (!actualAssetId)
      throw new Error('Use Mint Asset demo first.');
    wallet = await demoCreateWallet(network);
    const carrierSats = Number(wallet.dustAmount);
    const amount = assetTransferSats(wallet.dustAmount, paymentSats);
    sendStarted = true;
    const txid = await wallet.send({ address: address1, amount, assets: [{ assetId: actualAssetId, amount: 1n }] });

    // Assert
    return demoResult([`Transaction ID: ${txid}`, `Asset units: 1`, `Required carrier: ${carrierSats} sats`, `Optional payment: ${paymentSats} sats`, `Total sent: ${amount} sats and 1 asset unit`, `Success: ${Boolean(txid)}`].join('\n'), { explorer: { network, kind: 'ark-transaction', identifier: txid } });
  }
  catch (error) {
    throw assetSendIndexerError(error, sendStarted) ?? error;
  }
  finally {
    await demoDisposeWallet(wallet);
  }
}
