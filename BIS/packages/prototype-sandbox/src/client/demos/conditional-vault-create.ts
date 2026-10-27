// Arrange
import { demoGetInput } from '../navigation.ts';
import { createConditionalVault as demoCreateConditionalVault } from '../conditional-vault.ts';
import { demoCreateWallet } from '../demo-wallet.ts';
import { demoDisposeWallet, type DemoContext } from '../demo-runtime.ts';
import { demoRecoverVault, demoVaultResult } from '../vault-demo-runtime.ts';

export async function runDemo(context: DemoContext) {
  const { network, recover = false } = context;
  const selection = demoGetInput(network, 'vault-id') || '0000';
  const mnemonic = demoGetInput(network, 'wallet-2-mnemonic');
  if (!mnemonic.trim())
    throw new Error('Wallet2Mnemonic is required.');

  // Act
  let result;
  if (recover)
    result = await demoRecoverVault(context, selection);
  else {
    const wallet = await demoCreateWallet(network, { mnemonic, isolated: true });
    try {
      result = await demoCreateConditionalVault(network, wallet, `conditional-vault-${selection}`);
    }
    finally {
      await demoDisposeWallet(wallet);
    }
  }

  // Assert
  return demoVaultResult(network, selection, result, { includeCompiledSource: true });
}
