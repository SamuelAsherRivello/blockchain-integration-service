# Proposal

## Approved release contract, 2026-10-29

This decision supersedes older Signet-only scope, mode labels, fallback behavior and publication ordering below. The user requires two complete user-facing workflows: Mutinynet uses **Local**, with the browser-held Game Wallet and every previously enabled feature; Signet uses **Server**, with a local Player Wallet and server-assisted Game Wallet. There is no mode toggle in this version. The shared top header shows `Local` or `Server` in its upper-left corner and retains network and BIS version. Connection health is a separate fact.

Mutinynet enters Local before any server probe and works with BIS server access stopped, unreachable or unconfigured. Local still uses real Arkade/Bitcoin providers. Signet selects Server; an outage reports its cause and keeps the selected mode Server. The client must not offer a Local mode switch on Signet or silently replay/replace an operation's signer. The release must not disable a previously enabled feature to satisfy parity.

Treasure contract validation and wallet signing source are separate. Qualify Treasure on both networks if the real compiled contract lifecycle works on both. If a demonstrated network limitation prevents that, fully qualify the easiest network and report the other as unsupported with a reason through the existing Contracts `available` / `reason` indicator; do not add another checkbox or capability field. Do not offer new unsupported-network funding, but preserve inspection and recovery of existing contracts. Unsupported stronger contract guarantees and hosted Mutinynet signing remain outside this release. `qualify-bis-server-two-network-readiness` remains a deferred future hosted-network change.

Follow the authoritative nine-step order in `openspec/programs/bis-server-treasure-release/program.md`: freeze the feature/budget checklist; implement Local Mutinynet and Server Signet routing plus the header; verify both BIS workflows; freeze/import one immutable candidate; qualify the game; finish all four standalone Sandbox pages; publish matching releases; then verify public routes and close only evidenced tasks. See design.md and tasks.md for owners and exit criteria.

Local candidate export/import requires frozen source, passing package checks and exact provenance. It does not require prior Pages publication and does not claim final live acceptance. Final acceptance and publication require the same immutable candidate to pass both required workflows. Changed packed bytes require a new candidate and affected checks; no source-folder dependencies or silent repacking.

## Historical execution takeover, 2026-10-29 (superseded)

This section records an earlier coordination snapshot. Its wording and release order do not override the current release contract above or the BIS program's authoritative nine-step plan.

Confirmed Production authorization: the human selected option 1 in Grill Question 1, explicitly approving `BIS_PUBLIC_SETTLEMENT_SIGNING=true`, `BIS_PUBLIC_CONTRACT_SIGNING=true` and `BIS_PUBLIC_ASSET_SIGNING=true` in the existing Vercel Production service for Signet only. Preserve existing grants, recipient checks, signer keys, access protections, 5,000-sat operation and 10,000-sat daily limits. This permission is not evidence that configuration or live acceptance has passed. The human then ended the interview and explicitly requested complete implementation and deployment without further routine permission stops.

The user requested replacement ownership, minimum calendar time and a two-hour completion target. Reuse this change and its acceptance criteria; do not restart its implementation or migrate unfinished requirements into a nominally completed replacement. The server/BIS execution chat owns this change under the current takeover section of the BIS program ledger.

Finish current Signet Server signing, Local Mutinynet behavior, Admin/Marketplace release and the verified integration archive. The Treasure/game owner performs the adjacent-game import and release portions after the BIS acceptance gate is satisfied.

The local integration-candidate gate is frozen source, package verification and exact provenance. Tasks 5.1 and 5.5 still require real acceptance, and 5.2/5.4 still require verified publication before final completion. Publication is not a prerequisite for local candidate import.

The execution target ends at 15:28 UTC on 2026-10-29. This target does not waive live evidence, spending limits or uncertain-operation preservation. Report an exact external blocker once, continue independent authorized work, and reopen the blocked action only when its recorded prerequisite changes.

The [hosted two-network follow-up](../qualify-bis-server-two-network-readiness/proposal.md) remains deferred; it does not block Local Mutinynet in this release.

## Why

Players currently configure a second browser wallet to exercise Game Wallet features. A server-held game signer removes that setup in local development and published demos while retaining the existing manual login whenever no running server can be found.

## What Changes

- Create `BIS/packages/bis-server`, package `@bis/bis-server`, to own only the Game Wallet signing identity. Keep Player Wallet signing and existing game workflows in the browser.
- Load the game mnemonic from server-only `.env.local` locally and private environment configuration on Vercel. Return public identity and signatures, never the mnemonic.
- Support the same signing handlers through the root Vite server for local testing/debugging and through Vercel for published clients. The adjacent game uses its Vite origin with a local proxy or middleware.
- Resolve the known local API during development and a configured Vercel API in Pages builds. Probe only for Signet Server. Mutinynet Local must not probe or depend on BIS server access. On Signet, keep Server selected and report connection health separately if the endpoint is unavailable; do not offer a Local mode switch.
- Display exactly `Local` or `Server` in the upper-left of the shared header after network selection. Retain network/version and show connection health separately. Existing operations retain their original signer and recovery records.
- Include the minimal hosted authorization, signing-session state and wallet coordination required for Vercel correctness. Keep transaction preparation, submission, operation journals and reconciliation in the browser. Configure and enable the hosted signer for Signet only; Mutinynet uses the existing local Game Wallet.
- Export a verified immutable local candidate, integrate it in Stealth & Steel, and prove the required Local Mutinynet and Server Signet workflows before publishing matching BIS Admin, Marketplace and game releases. Final completion also requires Sandbox step 9 and any network-specific Treasure support reason through the existing Contracts indicator.

## Capabilities

### New Capabilities

- `bis-server-game-wallet`: Private Server Signet Game Wallet signing, Local Mutinynet Game Wallet behavior, signing parity and source-bound recovery.

### Modified Capabilities

- `user-facing-game-wallet`: Network-specific Local/Server Developer Settings, server connection health and the shared mode header.
- `admin-game-wallet`: Server-source exceptions to local identity import and lifecycle rules.
- `multi-package-development`: Same-Vite handlers, secret isolation, local/Pages backend selection and package documentation.
- `pages-demo-deployment`: Signet Vercel-backed Admin/Marketplace release and separately published matching game consumer.

## Impact

Targets integration Game Wallet composition, Arkade identity/session adapters, shared account shell, Admin/Marketplace consumers, root Vite tooling, bis-server deployment, and the adjacent game's vendored BIS package, account routing, Treasure gate and release metadata. Hosted signing is Signet-only; Local Mutinynet remains fully in scope. The standalone Sandbox does not depend on BIS Account/login or signing services. Unrelated gameplay and unfinished feature proposals are excluded.

SDK 0.4.79 exposes public keys, transaction/message signing and stateful signer sessions. Remote compatibility and Vercel restart/concurrency behavior must be proven; this proposal does not claim they already work. The no-custom-server project constraint receives a scoped exception for the game signer. Existing fee payer, trophy eligibility and gameplay rules remain unchanged.

Implementation defaults are `/api/bis/`, a Signet test-wallet identity, and a serverless-compatible store for signing-session/coordination metadata. The existing multi-network implementation may remain, but this release configures and exposes hosted signing only for Signet. Hosted Mutinynet wallet selection, funding and signing acceptance belong to the deferred proposal; Local Mutinynet feature acceptance is required now. Provider/project URLs and private credentials are deployment inputs to obtain privately during apply. A reachable but incompatible/unauthorized server reports its error rather than masquerading as an absent server.

Complete this Local Mutinynet / Server Signet release before future hosted Mutinynet work. Local Mutinynet regression and real network-backed Treasure acceptance belong to this release and the linked Treasure changes. Full-operation server execution remains separately deferred to `host-bis-server-game-wallet`.
