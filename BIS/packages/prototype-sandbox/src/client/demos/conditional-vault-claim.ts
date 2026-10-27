// Arrange
import { demoGetInput } from '../navigation.ts';
import { claimConditionalVault as demoClaimConditionalVault } from '../conditional-vault.ts';
import { demoCreateWallet } from '../demo-wallet.ts';
import { demoDisposeWallet, type DemoContext } from '../demo-runtime.ts';
import { demoRequireVault, demoVaultResult } from '../vault-demo-runtime.ts';

export async function runDemo({ network, recover = false }: DemoContext) {
  const selection = demoGetInput(network, 'vault-id') || '0000';
  const mnemonic = demoGetInput(network, 'wallet-2-mnemonic');
  if (!mnemonic.trim())
    throw new Error('Wallet2Mnemonic is required.');

  // Act
  const descriptor = await demoRequireVault(network, selection);
  const wallet = await demoCreateWallet(network, { mnemonic, isolated: true, signerOnly: true });
  let result;
  try {
    result = await demoClaimConditionalVault(network, wallet, descriptor, recover);
  }
  finally {
    await demoDisposeWallet(wallet);
  }

  // Assert
  return demoVaultResult(network, selection, result);
}
