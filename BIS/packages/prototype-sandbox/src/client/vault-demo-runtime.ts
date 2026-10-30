import type { TestNetwork } from '../../../integration/src/client/state-layer-core/test-network.ts';
import type { RestIndexerProvider } from '@arkade-os/sdk';
import { conditionalVaultArtifact, demoClaimConditionalVault, demoReadConditionalVaultDescriptor } from './conditional-vault.ts';
import { demoCreateWallet } from './demo-wallet.ts';
import { demoGetInput } from './navigation.ts';
import { demoDisposeWallet, demoResult, type DemoContext, type DemoResult } from './demo-runtime.ts';

type Inspection = Awaited<ReturnType<typeof import('./conditional-vault.ts').demoCheckConditionalVault>>;
type Mutation = Awaited<ReturnType<typeof demoClaimConditionalVault>>;

export async function demoRequireVault(network: TestNetwork, selection: string) {
  const descriptor = await demoReadConditionalVaultDescriptor(network, `conditional-vault-${selection}`);
  if (!descriptor) throw new Error(`VaultID ${selection} does not exist. Create it first in this browser.`);
  return descriptor;
}

export async function demoRecoverVault(context: DemoContext, selection: string, indexer?: RestIndexerProvider) {
  if (!demoGetInput(context.network, 'wallet-2-mnemonic').trim()) throw new Error('Wallet2Mnemonic is required.');
  const descriptor = await demoRequireVault(context.network, selection);
  const wallet = await demoCreateWallet(context.network, { isolated: true, signerOnly: true });
  try {
    return await demoClaimConditionalVault(context.network, wallet, descriptor, true, indexer);
  } finally { await demoDisposeWallet(wallet); }
}

export function demoVaultResult(network: TestNetwork, selection: string, result: Mutation | { inspection: Inspection }, { checkOnly = false, includeCompiledSource = false } = {}): DemoResult {
  const inspected = result.inspection;
  const next = inspected?.descriptor;
  const outcome = 'outcome' in result ? result.outcome : undefined;
  const reason = 'reason' in result ? result.reason : undefined;
  const success = checkOnly
    ? Boolean(inspected && ['locked', 'claimable', 'claimed', 'recovered', 'expired'].includes(inspected.status))
    : outcome === 'verified' || outcome === 'already-resolved';
  const receipt = demoResult([
    `Network: ${network}`, `Vault ID: ${next?.id ?? selection}`, 'Amount: 1000 sats', 'Transaction fee: 0 sats',
    ...(outcome ? [`Outcome: ${outcome}`] : []),
    ...(inspected && next ? [
      `Progress: ${inspected.progress ?? 'unknown'} / 3`, `Status: ${inspected.status}`,
      `Time left: ${Math.max(0, next.deadline - Math.floor(Date.now() / 1000))} seconds`,
      `Deadline: ${new Date(next.deadline * 1000).toISOString()}`,
      `Funding Transaction ID: ${next.funding.transactionId}`,
      ...inspected.evidence.map(e => `Verified Transaction ID: ${e.transactionId}`),
    ] : []),
    ...(reason ? [`Reason: ${reason}`] : []),
    ...(reason === 'vault-insufficient-funds' ? ['Next: fund Wallet 2 with at least 1000 spendable Arkade sats, then retry. Check its available balance in Get Balance (Private wallet).'] : []),
    `Success: ${success}`,
  ].join('\n'), {
    explorer: inspected && next && ['locked', 'claimable', 'expired', 'claimed', 'recovered', 'pending'].includes(inspected.status)
      ? { network, kind: 'ark-transaction', identifier: inspected.evidence.at(-1)?.transactionId ?? next.funding.transactionId } : undefined,
    recoverable: inspected?.status === 'expired' && Boolean(inspected.activeOutput),
    vaultId: selection,
    creatorPublicKey: next?.creatorPublicKey,
  });
  return includeCompiledSource && next ? { ...receipt, compiledSource: conditionalVaultArtifact(next) } : receipt;
}

export function demoVaultErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  if (/^vault-[a-z-]+$/.test(message) || /^VaultID [0-9]{4} (?:is already taken\.|does not exist\.|has no verified active output\.)/.test(message) || message === 'Wallet2Mnemonic is required.') return message;
  if (error instanceof TypeError && /fetch|network|load failed/i.test(message))
    return 'The browser could not reach an Arkade network service. Check the operator and local co-signer connections before retrying.';
  if (!(error instanceof Error)) return 'Unknown error. See the browser console for details.';
  // Do not copy wallet secrets or signed recovery material into the visible output.
  if (/mnemonic|recovery phrase|private key|secret|seed|psbt/i.test(message) || /(?:\b[a-z]+\s+){11,}[a-z]+\b/i.test(message))
    return `${error.name}: Details withheld because they may contain wallet data.`;
  const detail = message
    .replace(/https?:\/\/[^\s)]+/gi, '[URL]')
    .replace(/\b[A-Za-z0-9+/=_-]{48,}\b/g, '[data]')
    .replace(/[\r\n\t]+/g, ' ')
    .slice(0, 300);
  return `${error.name}: ${detail || 'No error message was provided.'}`;
}
