# Prototype Sandbox Smart Contracts

The Prototype Sandbox Conditional Vault is a small, network-backed Arkade
contract example. It locks 100 Arkade sats in a contract-derived VTXO, then
allows three covenant-enforced state transitions before the creator can claim
the same value back.

The four demos are:

1. **Create** builds the immutable contract state chain and funds state 0 from
   Wallet 2. The result includes the contract address and funding transaction.
2. **Increment** spends the current state to the next contract state. The
   Arkade script checks the committed next script and preserves the 100-sat
   value. The transition does not require the caller's mnemonic.
3. **Check** queries the selected network's operator/indexer without a
   mnemonic or fund movement. The indexed VTXO is the source of truth for the
   progress and claimable state.
4. **Claim** uses the creator identity to spend state 3 to the creator's
   Arkade script.

The Create page's Smart Contract tab shows the TypeScript builder definition,
the generated SDK artifact, and an Arkade-script disassembly example. The
other three pages show only their integration source because they invoke the
already-built contract rather than define it.

Arkade contracts are virtual/off-chain execution enforced by the Arkade
operator and covenant emulator. They are not immediate Bitcoin L1
transactions. The VTXO can later settle or exit according to the network's
rules; operator availability, fees, expiry, and settlement policy still apply.

The selected network controls every provider and contract address. Mutinynet's
hosted covenant emulator is currently available at
`https://emulator.mutinynet.arkade.sh`. The current hosted Signet operator
does not expose a covenant emulator endpoint, so the demo fails closed on
Signet with an explicit availability error rather than presenting a simulated
success. A Signet flow can be enabled once Arkade deploys or the project is
given an approved Signet emulator endpoint and matching co-signer key.

Live acceptance uses the existing encrypted agent test-wallet inventory. The
live runner is `BIS/scripts/conditional-vault-live.ts`; it emits only public
contract addresses, transaction IDs, progress, and status, never recovery
phrases. The runner must be executed in the Windows profile where that
encrypted inventory is initialized; an isolated agent sandbox without the
vault fails closed with `vault-not-initialized` and cannot substitute a
different account.
