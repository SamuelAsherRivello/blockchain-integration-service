import { InMemoryContractRepository, InMemoryWalletRepository, MnemonicIdentity, Wallet } from '@arkade-os/sdk';
import type { TestNetwork } from '../../../integration/src/client/state-layer-core/test-network.ts';
import { demoGetInput } from './navigation.ts';
import { demoGetNetwork } from './demo-utils.ts';
import { sandboxWalletStorage as demoCreateWalletStorage } from './wallet-storage.ts';
import { installWalletMaintenance } from './wallet-maintenance.ts';

type DemoWalletOptions = {
  mnemonic?: string;
  isolated?: boolean;
  signerOnly?: boolean;
  freshContracts?: boolean;
  refresh?: boolean;
  walletMode?: 'auto' | 'hd';
};

export async function demoRefreshWallet(wallet: Pick<Wallet, 'getContractManager' | 'getVtxos'>) {
  const contractManager = await wallet.getContractManager();
  await contractManager.refreshVtxos();
  return wallet.getVtxos();
}

export async function demoCreateWallet(network: TestNetwork, {
  mnemonic = demoGetInput(network, 'wallet-2-mnemonic'),
  isolated = false,
  signerOnly = false,
  freshContracts = false,
  refresh = true,
  walletMode = 'hd',
}: DemoWalletOptions = {}) {
  if (!mnemonic.trim()) throw new Error('Enter Wallet 2 Mnemonic on Setup Input first.');
  const identity = MnemonicIdentity.fromMnemonic(mnemonic, { isMainnet: false });
  const wallet = await Wallet.create({
    identity,
    arkServerUrl: demoGetNetwork(network).operator,
    walletMode: signerOnly ? 'static' : walletMode,
    lookAheadWindow: 20,
    settlementConfig: false,
    storage: isolated
      ? { walletRepository: new InMemoryWalletRepository(), contractRepository: new InMemoryContractRepository() }
      : demoCreateWalletStorage(network, identity, freshContracts),
  });
  await installWalletMaintenance(wallet, network, identity.descriptor);
  // Claim/Recover needs only the creator signature within its two-minute window.
  if (signerOnly || !refresh) return wallet;
  try {
    await demoRefreshWallet(wallet);
    return wallet;
  } catch (error) {
    try { await wallet.dispose(); } catch { /* Preserve the refresh error. */ }
    throw error;
  }
}

export async function demoWithFreshWallet<T>(network: TestNetwork, operation: (wallet: Wallet) => Promise<T>, options?: DemoWalletOptions) {
  for (let attempt = 0; attempt < 2; attempt++) {
    // See Create Wallet demo for more info
    const wallet = await demoCreateWallet(network, options);
    try {
      return await operation(wallet);
    } catch (error) {
      if (!String(error instanceof Error ? error.message : error).includes('VTXO_NOT_FOUND') || attempt === 1) throw error;
    } finally {
      try { await wallet.dispose(); } catch { /* Preserve the operation result. */ }
    }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error('Wallet retry exhausted.');
}
