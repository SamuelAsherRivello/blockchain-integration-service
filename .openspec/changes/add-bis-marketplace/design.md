## Context

See proposal.md for motivation. BIS already has React/TypeScript packages, Vite development workflows, browser-local F. Game Wallet access, and real Signet asset mint/list operations. This first slice must produce a static public experience without a hosted application service or wallet secrets.

## Goals / Non-Goals

**Goals:**

- Establish a standalone Marketplace package that can be served by Vite now and deployed as static files later.
- Mint a verifiable, game-keyed nine-item catalog through the existing Admin game wallet and render only verified entries.
- Let anonymous visitors inspect the registered wallet's inventory through its public address.

**Non-Goals:**

- Trading, player login, wallet signing from Marketplace, pricing, equipment selection, or Stealth & Steel behavior.
- A hosted API, database, indexer, custody service, or private data in static files.

## Decisions

### Static public catalog with public-address inventory lookup

The Marketplace bundle will include public catalog metadata and the registered game-wallet address. It will perform only read-only availability lookup for that address. The address is public information; recovery and signing materials remain in browser-local account storage. This makes public browse compatible with GitHub Pages. The alternative of requiring game-wallet login to browse is rejected because it would defeat anonymous discovery.

### Vite development publication boundary

H. Marketplace will reuse the local development tooling to place verified public catalog data into the Marketplace's static bundle input after minting. Production hosting serves only those generated static files; it does not host an Admin action or a BIS API. This follows the existing local-development configuration pattern while avoiding a custom runtime service.

### Idempotent catalog identities

Each of the nine named catalog entries receives a stable game ID, family, tier, and operation identity before minting. H reconciles a known earlier result instead of treating a lost acknowledgement as permission to issue another asset. The alternative of minting an untracked batch is rejected because it cannot truthfully distinguish stock from duplicate issuance.

## Risks / Trade-offs

- [A public inventory source cannot be read at the moment of browse] → Show availability as unreadable, never as empty stock or a successful trade.
- [A batch acknowledgement is interrupted] → Preserve the original item and operation identities and provide reconciliation only.
- [The public bundle is stale after a later mint] → Publish only verified records and require a new static build/deployment; no runtime result is fabricated.

## Migration Plan

1. Add the Marketplace workspace and its minimal public page.
2. Add the public catalog model and Admin H issuance/reconciliation flow.
3. Generate verified public catalog input, build the static Marketplace, and deploy it through the chosen static-host workflow.
4. Roll back by serving the prior static bundle; no wallet secrets or irreversible data migration are introduced.
