
//////////////////////////////////////////
// Arrange
//////////////////////////////////////////
import {
  demoGetInput,
  demoCreateWallet,
  demoDisposeWallet,
  demoRecoverVault,
  demoVaultResult,
  demoVaultClient,
  demoVaultOperationId,
  demoForgetVaultOperationId,
  demoRememberVaultResult,
  demoReadConditionalVaultDescriptor,
  compileConditionalVault,
  hex,
  type DemoContext,
  type TestNetwork,
} from '../sandbox-shared.ts';
import { MnemonicIdentity, getNetwork, type Wallet } from '@arkade-os/sdk';

export async function demoCreateConditionalVault(network: TestNetwork, wallet: Wallet, id: string) {
  const displayId = id.replace(/^conditional-vault-/, '');
  const creator = Array.from(await wallet.identity.xOnlyPublicKey(), (b) => b.toString(16).padStart(2, "0")).join("");
  if (await demoReadConditionalVaultDescriptor(network, id, creator))
    throw Error(`VaultID ${displayId} is already taken.`);
  const client = demoVaultClient(network, wallet, undefined, {
    // Compile the real covenant, derive its address and fund its first state.
    // The supporting client journals this callback's signed request before dispatch.
    async fund({ wallet, parameters }) {
      const compiled = compileConditionalVault(parameters);
      const firstState = compiled.states[0];
      const contractAddress = firstState.script.address(getNetwork(network).hrp, hex.decode(parameters.serverKey)).encode();
      return wallet.send({ address: contractAddress, amount: 1000 });
    },
  });
  const binding = `${creator}:${displayId}`;
  const attempt = async () => {
    const operationId = demoVaultOperationId(network, "create", binding);
    const result = await client.create({ network, id: displayId, walletReference: "wallet-2", operationId, durationSeconds: 120 });
    if (result.outcome === 'rejected') demoForgetVaultOperationId(network, 'create', binding, operationId);
    return result;
  };
  let result = await attempt();
  // A previously interrupted, unsubmitted preparation can be replaced safely.
  if (result.outcome === 'rejected' && result.reason === 'vault-original-request-not-submitted') result = await attempt();
  return demoRememberVaultResult(result);
}
export async function runDemo(context: DemoContext) {
  const { network, recover = false } = context;
  const selection = demoGetInput(network, 'vault-id') || '0000';
  const mnemonic = demoGetInput(network, 'wallet-2-mnemonic');
  if (!mnemonic.trim())
    throw new Error('Wallet2Mnemonic is required.');

  //////////////////////////////////////////
  // Act
  //////////////////////////////////////////
  let result;
  if (recover)
    result = await demoRecoverVault(context, selection);
  else {
    const wallet = await demoCreateWallet(network, { identity: MnemonicIdentity.fromMnemonic(mnemonic, { isMainnet: false }), isolated: true });
    try {
      result = await demoCreateConditionalVault(network, wallet, `conditional-vault-${selection}`);
    }
    finally {
      await demoDisposeWallet(wallet);
    }
  }

  //////////////////////////////////////////
  // Assert
  //////////////////////////////////////////
  return demoVaultResult(network, selection, result, { includeCompiledSource: true });
}
