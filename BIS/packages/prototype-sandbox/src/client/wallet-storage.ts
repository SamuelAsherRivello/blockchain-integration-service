import { IndexedDBContractRepository, IndexedDBWalletRepository, InMemoryContractRepository } from '@arkade-os/sdk';

/** Keep the established mint/upgrade namespace; never reset the SDK's shared DB. */
export function sandboxWalletDatabase(network: string, descriptor: string) {
  if (!['signet', 'mutinynet'].includes(network)) throw new Error('Unsupported sandbox network.');
  const fingerprint = descriptor.match(/\[([0-9a-f]+)\//i)?.[1]?.toLowerCase();
  if (!fingerprint) throw new Error('Could not determine the wallet identity.');
  // The SDK also checks the complete descriptor before reusing persisted HD state.
  return `bis-prototype-sandbox-wallet-v1:${network}:${fingerprint}`;
}

export function demoCreateWalletStorage(network: string, identity: { descriptor: string }, freshContracts = false) {
  const database = sandboxWalletDatabase(network, identity.descriptor);
  return {
    walletRepository: new IndexedDBWalletRepository(database),
    contractRepository: freshContracts ? new InMemoryContractRepository() : new IndexedDBContractRepository(database),
  };
}
