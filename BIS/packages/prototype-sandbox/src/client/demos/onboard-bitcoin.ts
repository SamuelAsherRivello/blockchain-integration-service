
//////////////////////////////////////////
// Arrange
//////////////////////////////////////////
import { demoResult, demoDisposeWallet, demoErrorMessage, type DemoContext, demoCreateWallet, demoOnboardBitcoin } from '../sandbox-shared.ts';

export async function runDemo({ network }: DemoContext) {
  let wallet;
  let boardingAddress = '';
  let arkadeAddress = '';

  //////////////////////////////////////////
  // Act
  //////////////////////////////////////////
  try {
    wallet = await demoCreateWallet(network, { isolated: true });
    boardingAddress = await wallet.getBoardingAddress();
    arkadeAddress = await wallet.getAddress();
    const { fees } = await wallet.arkProvider.getInfo();
    const result = await demoOnboardBitcoin(wallet, fees);

    //////////////////////////////////////////
    // Assert
    //////////////////////////////////////////
    if (result.status === 'settled')
      return demoResult([`Boarding from address: ${boardingAddress}`, `Boarding to address: ${arkadeAddress}`, `Onboarding Transaction ID: ${result.txid}`, 'Matching Arkade batch: finalized', 'Success: true'].join('\n'), { explorer: { network, kind: 'bitcoin-transaction', identifier: result.txid } });
    if (result.status === 'failed')
      return demoResult([`Boarding from address: ${boardingAddress}`, `Boarding to address: ${arkadeAddress}`, `Matching Arkade batch: failed`, `Batch ID: ${result.batchId}`, `Error: ${result.message}`, 'Next: reconcile this batch in the Onboarding page before retrying.', 'Success: false'].join('\n'), { explorer: { network, kind: 'bitcoin-address', identifier: boardingAddress } });
    return demoResult([`Boarding from address: ${boardingAddress}`, `Boarding to address: ${arkadeAddress}`, 'Status: pending reconciliation', `Details: ${result.message}`, 'Success: not verified', 'Next: check the Onboarding page before retrying.'].join('\n'), { explorer: { network, kind: 'bitcoin-address', identifier: boardingAddress } });
  }
  catch (error) {
    const message = demoErrorMessage(error);
    const nextStep = /not confirmed/i.test(message) ? 'Next: wait for this Bitcoin input to confirm, then retry.' : 'Next: check the Onboarding page before retrying.';
    return demoResult([...(boardingAddress ? [`Boarding from address: ${boardingAddress}`] : []), ...(arkadeAddress ? [`Boarding to address: ${arkadeAddress}`] : []), ...(boardingAddress ? [nextStep] : []), `Error: ${message}`, 'Success: false'].join('\n'), { explorer: boardingAddress ? { network, kind: 'bitcoin-address', identifier: boardingAddress } : undefined });
  }
  finally {
    await demoDisposeWallet(wallet);
  }
}
