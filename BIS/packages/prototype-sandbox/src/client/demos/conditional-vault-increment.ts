
//////////////////////////////////////////
// Arrange
//////////////////////////////////////////
import {
  demoReadRecoveryRequest,
  demoWriteRecoveryRequest,
  demoClearRecoveryRequest,
  type VaultOutpoint,
  demoGetInput,
  demoRequireVault,
  demoRecoverVault,
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
  type VaultDemoExecution,
} from '../sandbox-shared.ts';
import { arkade, getNetwork, Transaction, type RestIndexerProvider } from '@arkade-os/sdk';

export async function executeIncrement({ network, descriptor, before, identity, ark, indexer, emulator }: Parameters<NonNullable<VaultDemoExecution['spend']>>[0]) {
  const client = await arkade.Arkade.connect({ arkade: ark, indexer, emulator,
    emulatorPubkey: `03${descriptor.emulatorPublicKey}`, network: getNetwork(network), identity });
  const compiled = compileVaultDescriptor(descriptor);
  const progress = before.progress!;
  const state = compiled.states[progress];
  const contract = client.contract(state.program, state.args);
  const coin = { txid: before.activeOutput!.transactionId, vout: before.activeOutput!.outputIndex, value: 1000 };
  const destination = hex.decode(descriptor.stateScripts[progress + 1]);
  const { arkTx, checkpoints } = await contract.functions.increment().from(coin).to(destination, 1000n).build();
  normalizeVaultOutputLayout(arkTx);
  const signed = arkTx;
  const signedCheckpoints = checkpoints;
  const receipt = await emulator.submitTx(base64.encode(signed.toPSBT()), signedCheckpoints.map(tx => base64.encode(tx.toPSBT())));
  const returned = Transaction.fromPSBT(base64.decode(receipt.signedArkTx));
  if (returned.id !== arkTx.id)
    throw Error('vault-spend-acknowledgement-mismatch');
  return { txid: returned.id };
}
export async function demoIncrementConditionalVault(network: TestNetwork, descriptor: VaultPublicDescriptor, indexer?: RestIndexerProvider) {
  const client = demoVaultClient(network, undefined, indexer, { spend: executeIncrement }), pendingKey = `bis-vault-ui-pending:${network}:${descriptor.hash}:increment`;
  const original = demoReadRecoveryRequest<{
    operationId: string;
    expectedOutput: VaultOutpoint;
  }>(pendingKey);
  if (original) {
    const result = await client.increment({ ...original, descriptor });
    if (["verified", "rejected", "already-resolved"].includes(result.outcome))
      demoClearRecoveryRequest(pendingKey);
    return demoRememberVaultResult(result);
  }
  const expectedOutput = demoObservedOutputHint(descriptor) ??
    // See Check Conditional Vault demo for more info
    (await demoCheckConditionalVault(network, descriptor, indexer)).activeOutput;
  if (!expectedOutput)
    throw Error(`VaultID ${descriptor.id} has no verified active output. Check its network status.`);
  const request = {
    expectedOutput,
    operationId: demoVaultOperationId(network, "increment", `${descriptor.hash}:${expectedOutput.transactionId}:${expectedOutput.outputIndex}`),
  };
  demoWriteRecoveryRequest(pendingKey, request);
  const result = await client.increment({ ...request, descriptor });
  if (["verified", "rejected", "already-resolved"].includes(result.outcome))
    demoClearRecoveryRequest(pendingKey);
  return demoRememberVaultResult(result);
}
export async function runDemo(context: DemoContext) {
  const { network, recover = false } = context;
  const selection = demoGetInput(network, 'vault-id') || '0000';

  //////////////////////////////////////////
  // Act
  //////////////////////////////////////////
  const result = recover ? await demoRecoverVault(context, selection)
    : await demoIncrementConditionalVault(network, await demoRequireVault(network, selection));

  //////////////////////////////////////////
  // Assert
  //////////////////////////////////////////
  return demoVaultResult(network, selection, result);
}
