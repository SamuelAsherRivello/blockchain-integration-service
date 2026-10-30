
//////////////////////////////////////////
// Arrange
//////////////////////////////////////////
import {
  demoRefreshWallet,
  demoGetMnemonic,
  demoGetInput,
  demoGetNetwork,
  demoCreateWalletStorage,
  installWalletMaintenance,
  demoResult,
  demoDisposeWallet,
  type DemoContext,
  type TestNetwork,
} from '../sandbox-shared.ts';
import { MnemonicIdentity, Wallet, InMemoryWalletRepository, InMemoryContractRepository } from '@arkade-os/sdk';

export type DemoWalletOptions = {
  identity?: MnemonicIdentity;
  mnemonic?: string;
  isolated?: boolean;
  signerOnly?: boolean;
  freshContracts?: boolean;
  refresh?: boolean;
  walletMode?: 'auto' | 'hd';
};
export async function demoCreateWallet(network: TestNetwork, { identity: suppliedIdentity, mnemonic, isolated = false, signerOnly = false, freshContracts = false, refresh = true, walletMode = 'hd', }: DemoWalletOptions = {}) {
  if (mnemonic !== undefined && !mnemonic.trim())
    throw new Error('Enter Wallet 2 Mnemonic on Setup Input first.');
  const identity = suppliedIdentity ?? MnemonicIdentity.fromMnemonic(mnemonic ?? demoGetMnemonic(network), { isMainnet: false });
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
  if (signerOnly || !refresh)
    return wallet;
  try {
    await demoRefreshWallet(wallet);
    return wallet;
  }
  catch (error) {
    try {
      await wallet.dispose();
    }
    catch { /* Preserve the refresh error. */ }
    throw error;
  }
}
export async function runDemo({ network }: DemoContext) {
  const currentMnemonic = demoGetInput(network, 'wallet-2-mnemonic');
  if (!currentMnemonic.trim())
    throw new Error('Enter Wallet 2 Mnemonic on Setup Input first.');
  let wallet;

  //////////////////////////////////////////
  // Act
  //////////////////////////////////////////
  try {
    wallet = await demoCreateWallet(network, { mnemonic: currentMnemonic, walletMode: 'auto', refresh: false });
    const address = await wallet.getAddress();

    //////////////////////////////////////////
    // Assert
    //////////////////////////////////////////
    return demoResult([`Arkade Address: ${address}`, `Success: ${Boolean(address)}`].join('\n'));
  }
  finally {
    await demoDisposeWallet(wallet);
  }
}
