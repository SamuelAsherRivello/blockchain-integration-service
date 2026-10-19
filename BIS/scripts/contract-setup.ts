import { MnemonicIdentity } from '@arkade-os/sdk';
import { inspectContractSetup } from '../packages/integration/src/client/wallet-layer-arkade/contract-setup.ts';
import { Vault } from './test-wallets/vault.ts';
import { verifiedInventory } from './test-wallets/inventory.ts';

// The private wallet inventory stays inside its existing encrypted storage.
// Output contains only setup checks; arbitrary SDK errors are never echoed.
try {
  const accountLabel = process.argv[2];
  if (!accountLabel || process.argv.length !== 3) throw Error('contract-setup-account-required');
  const vault = new Vault();
  const results = await vault.transaction(async state => {
    await verifiedInventory(state);
    const account = state.accounts.find(row => row.label === accountLabel);
    if (!account || !account.grant?.active) throw Error('contract-setup-account-unavailable');
    const identity = MnemonicIdentity.fromMnemonic(account.phrase, { isMainnet: false });
    const key = await identity.xOnlyPublicKey();
    const checks = [];
    for (const network of ['signet', 'mutinynet'] as const) {
      if (!account.grant.networks.includes(network)) throw Error('contract-setup-network-not-authorized');
      checks.push(await inspectContractSetup(network, key));
    }
    return checks;
  });
  process.stdout.write(`${JSON.stringify({ success: true, checks: results })}\n`);
} catch (error) {
  const message = error instanceof Error && /^(contract-setup-[a-z-]+|vault-[a-z-]+|unsafe-private-path)$/.test(error.message)
    ? error.message : 'contract-setup-unavailable';
  process.stdout.write(`${JSON.stringify({ success: false, reason: message })}\n`);
  process.exitCode = 1;
}
