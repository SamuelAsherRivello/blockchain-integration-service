
//////////////////////////////////////////
// Arrange
//////////////////////////////////////////
import {
  demoGetInput,
  demoCreateWallet,
  demoDisposeWallet,
  demoRequireVault,
  demoVaultResult,
  demoVaultClient,
  demoVaultOperationId,
  demoRememberVaultResult,
  demoObservedOutputHint,
  demoCheckConditionalVault,
  compileVaultDescriptor,
  normalizeVaultOutputLayout,
  hex,
  base64,
  type DemoContext,
  type TestNetwork,
  type VaultPublicDescriptor,
  type VaultMutationResult,
  type VaultDemoExecution,
} from '../sandbox-shared.ts';
import { arkade, getNetwork, Transaction, MnemonicIdentity, type Wallet, type RestIndexerProvider } from '@arkade-os/sdk';

export async function executeClaim({ network, descriptor, before, operation, identity, ark, indexer, emulator }: Parameters<NonNullable<VaultDemoExecution['spend']>>[0]) {
  const client = await arkade.Arkade.connect({ arkade: ark, indexer, emulator,
    emulatorPubkey: `03${descriptor.emulatorPublicKey}`, network: getNetwork(network), identity });
  const compiled = compileVaultDescriptor(descriptor);
  const progress = before.progress!;
  const state = compiled.states[progress];
  const contract = client.contract(state.program, state.args);
  const coin = { txid: before.activeOutput!.transactionId, vout: before.activeOutput!.outputIndex, value: 1000 };
  const destination = hex.decode(descriptor.creatorDestination);
  const { arkTx, checkpoints } = await contract.functions[operation]().from(coin).to(destination, 1000n).build();
  normalizeVaultOutputLayout(arkTx);
  if (!identity)
    throw Error('vault-spend-creator-required');
  const signed = await identity.sign(arkTx, [0]);
  const signedCheckpoints = await Promise.all(checkpoints.map(tx => identity.sign(tx, [0])));
  const receipt = await emulator.submitTx(base64.encode(signed.toPSBT()), signedCheckpoints.map(tx => base64.encode(tx.toPSBT())));
  const returned = Transaction.fromPSBT(base64.decode(receipt.signedArkTx));
  if (returned.id !== arkTx.id)
    throw Error('vault-spend-acknowledgement-mismatch');
  return { txid: returned.id };
}
export async function demoClaimConditionalVault(network: TestNetwork, wallet: Wallet, descriptor: VaultPublicDescriptor, recover = false, indexer?: RestIndexerProvider) {
  const client = demoVaultClient(network, wallet, indexer, { spend: executeClaim }), operation = recover ? "recover" : "claim";
  let expectedOutput = demoObservedOutputHint(descriptor);
  if (!expectedOutput) {
    // See Check Conditional Vault demo for more info
    const checked = await demoCheckConditionalVault(network, descriptor, indexer);
    if (["claimed", "recovered"].includes(checked.status))
      return {
        operationId: "resolved",
        operation,
        outcome: "already-resolved",
        inspection: checked,
      } as VaultMutationResult;
    expectedOutput = checked.activeOutput;
  }
  if (!expectedOutput)
    throw Error(`VaultID ${descriptor.id} has no verified active output. Check its network status.`);
  return demoRememberVaultResult(await client[operation]({
    descriptor,
    expectedOutput,
    walletReference: "wallet-2",
    operationId: demoVaultOperationId(network, operation, `${descriptor.hash}:${expectedOutput.transactionId}:${expectedOutput.outputIndex}`),
  }));
}
export async function runDemo({ network, recover = false }: DemoContext) {
  const selection = demoGetInput(network, 'vault-id') || '0000';
  const mnemonic = demoGetInput(network, 'wallet-2-mnemonic');
  if (!mnemonic.trim())
    throw new Error('Wallet2Mnemonic is required.');

  //////////////////////////////////////////
  // Act
  //////////////////////////////////////////
  const descriptor = await demoRequireVault(network, selection);
  const wallet = await demoCreateWallet(network, { identity: MnemonicIdentity.fromMnemonic(mnemonic, { isMainnet: false }), isolated: true, signerOnly: true });
  let result;
  try {
    result = await demoClaimConditionalVault(network, wallet, descriptor, recover);
  }
  finally {
    await demoDisposeWallet(wallet);
  }

  //////////////////////////////////////////
  // Assert
  //////////////////////////////////////////
  return demoVaultResult(network, selection, result);
}
