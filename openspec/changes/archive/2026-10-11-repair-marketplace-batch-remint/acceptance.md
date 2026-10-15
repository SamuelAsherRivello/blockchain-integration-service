# Acceptance

## Automated checks

- 66 focused asset adapter, SDK metadata transport, generation, Admin batch/catalog/list/burn, Marketplace inventory and network checks pass. Includes mint → burn → remint → interrupted retry → completed retry, unchanged structured metadata, positive/unknown supply refusal, pending-history protection and scoped network isolation.
- Typecheck passes.
- Integration, Admin and Marketplace production builds pass. Existing bundle-size warnings remain; no build failure.
- Strict OpenSpec validation and scoped whitespace checks pass.
- React review: session address selection follows subscribed wallet state and participates in inventory source dependencies; async preparation checks the captured account/network scope before minting. No new SDK signer or stored recovery material.

## Live acceptance

On 2026-10-11, the registered disposable Mutinynet `market-remint-pair` passed the required Admin-to-Marketplace scenario at `http://127.0.0.1:5174`. Fresh protected readiness showed zero pending operations and 20,000 available Arkade sats. C.G.2 completed with nine verified catalog items at 17:35:58 UTC. An independent public indexer read verified nine distinct catalog IDs, quantity one each, and exact BIS attribute deltas: movementSpeed +10/+20/+30, playerDamage +10/+20/+30, damageTaken -10/-20/-30.

The same pair was independently restored through normal UI in the protected Marketplace profile. At 17:37:34 UTC, the Game Wallet filter displayed all nine expected cards, matching the same public asset IDs. The protected browser closed and released its vault/profile locks. No recovery material, DOM dump, screenshot or signing secret was exported.

Sanitized evidence remains in ignored `output/reports/marketplace-batch-remint/market-remint-pair-mint-1791740165728.json` and `market-remint-pair-marketplace-1791740255910.json`. Earlier helper navigation failures occurred before mint submission: the test attempted to read a dialog identity marker after normal dismissal removed it. Fixing test navigation allowed the unchanged production mint flow to pass.

Additional live burn/remint testing was **not performed**. Automatic approval review rejected C.G.3 on this disposable pair because burning on-chain assets is irreversible and direct approval for that exact operation is required. A retry citing the repository standing grant was also rejected; no workaround was used. All nine minted assets remain owned by the test Game Wallet. Automated burn/remint/retry coverage is separate evidence and is not claimed as live burn/remint acceptance. The required live Admin-to-Marketplace criterion is complete; this optional live burn test does not change that result.

## Public diagnosis

Read-only Signet indexer checks on 2026-10-11 found the historical nine v3 catalog assets at zero supply. Shoes I asset `ff49d341de723b17ebf8dc928a0b254ab47fc57493aa11ca6fe3147c14f9e7860000` records `marketplace-stealth-steel-shoes-1-v3` and compatible description, schema and movementSpeed +10 metadata. This supports the burned-generation diagnosis, not a claim that the failed click submitted a fresh mint.

No release, publication or personal-wallet mutation is included.


