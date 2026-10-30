
//////////////////////////////////////////
// Arrange
//////////////////////////////////////////
import { demoResult, demoDisposeWallet, demoErrorMessage, type DemoContext, demoCreateWallet } from '../sandbox-shared.ts';
import { OnchainWallet, Ramps } from '@arkade-os/sdk';

export async function runDemo({ network }: DemoContext) {
  let wallet;
  let arkadeAddress = '';
  let bitcoinAddress = '';

  //////////////////////////////////////////
  // Act
  //////////////////////////////////////////
  try {
    wallet = await demoCreateWallet(network, { isolated: true });
    arkadeAddress = await wallet.getAddress();
    bitcoinAddress = (await OnchainWallet.create(wallet.identity, network)).address;
    const { fees } = await wallet.arkProvider.getInfo();
    const txid = await new Ramps(wallet).offboard(bitcoinAddress, fees);

    //////////////////////////////////////////
    // Assert
    //////////////////////////////////////////
    return demoResult([`Offboarding from address: ${arkadeAddress}`, `Offboarding to address: ${bitcoinAddress}`, `Offboarding Transaction ID: ${txid}`, `Success: ${Boolean(txid)}`].join('\n'), { explorer: { network, kind: 'bitcoin-transaction', identifier: txid } });
  }
  catch (error) {
    return demoResult([...(arkadeAddress ? [`Offboarding from address: ${arkadeAddress}`] : []), ...(bitcoinAddress ? [`Offboarding to address: ${bitcoinAddress}`] : []), `Error: ${demoErrorMessage(error)}`, 'Success: false'].join('\n'), { explorer: bitcoinAddress ? { network, kind: 'bitcoin-address', identifier: bitcoinAddress } : undefined });
  }
  finally {
    await demoDisposeWallet(wallet);
  }
}
