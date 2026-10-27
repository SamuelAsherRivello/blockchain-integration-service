import { MnemonicIdentity, OnchainWallet } from '@arkade-os/sdk';
import type { TestNetwork } from '../../../integration/src/client/state-layer-core/test-network.ts';
import { demoGetInput } from './navigation.ts';

export async function getWallet2BitcoinAddress(network: TestNetwork) {
  const mnemonic = demoGetInput(network, 'wallet-2-mnemonic');
  if (!mnemonic.trim()) throw new Error('Enter Wallet 2 Mnemonic on Setup Input first.');
  const identity = MnemonicIdentity.fromMnemonic(mnemonic, { isMainnet: false });
  const wallet = await OnchainWallet.create(identity, network);
  return wallet.address;
}
