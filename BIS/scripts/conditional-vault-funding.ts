import { Vault } from "./test-wallets/vault.ts";
import { verifiedInventory } from "./test-wallets/inventory.ts";
import { loadBalance } from "../packages/integration/src/client/wallet-layer-arkade/balance.ts";

try {
  if (process.argv[2] !== "inspect" || process.argv.length !== 3)
    throw Error("vault-funding-use-inspect");
  const vault = new Vault();
  const accounts = await vault.transaction(async (state) => {
    await verifiedInventory(state);
    return state.accounts
      .filter((account) => account.grant?.active)
      .map((account) => ({ ...account }));
  });
  for (const account of accounts)
    for (const network of ["signet", "mutinynet"] as const) {
      if (!account.grant.networks.includes(network)) continue;
      try {
        const balances = await loadBalance(
          { ...account, network },
          AbortSignal.timeout(20_000),
        );
        process.stdout.write(
          JSON.stringify({
            account: account.label,
            network,
            ...balances,
            reportedPending: Boolean(account.reportedPending?.[network]),
          }) + "\n",
        );
      } catch {
        process.stdout.write(
          JSON.stringify({
            account: account.label,
            network,
            unavailable: true,
          }) + "\n",
        );
      }
    }
} catch (error) {
  const reason =
    error instanceof Error &&
    /^(vault-funding-[a-z-]+|vault-[a-z-]+)$/.test(error.message)
      ? error.message
      : "vault-funding-unavailable";
  process.stdout.write(JSON.stringify({ reason }) + "\n");
  process.exitCode = 1;
}
