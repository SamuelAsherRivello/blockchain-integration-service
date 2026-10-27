// Arrange
import { demoGetInput } from '../navigation.ts';
import { incrementConditionalVault as demoIncrementConditionalVault } from '../conditional-vault.ts';
import type { DemoContext } from '../demo-runtime.ts';
import { demoRequireVault, demoRecoverVault, demoVaultResult } from '../vault-demo-runtime.ts';

export async function runDemo(context: DemoContext) {
  const { network, recover = false } = context;
  const selection = demoGetInput(network, 'vault-id') || '0000';

  // Act
  const result = recover ? await demoRecoverVault(context, selection)
    : await demoIncrementConditionalVault(network, await demoRequireVault(network, selection));

  // Assert
  return demoVaultResult(network, selection, result);
}
