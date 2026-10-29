# Proposal

## Approved release contract, 2026-10-29

This decision supersedes the older Signet-only consumer scope and publication-before-import dependency below. The user requires two complete user-facing workflows: Mutinynet uses **Direct**, with the existing browser-held Game Wallet and every previously enabled feature; Signet uses **Server**, with a local Player Wallet and server-assisted Game Wallet. The shared top header shows the exact mode in its upper-left corner and retains network and BIS version. Mode and connection health are separate facts.

Mutinynet enters Direct before any server probe and works with the BIS server stopped, unreachable or unconfigured. Direct still uses real Arkade/operator services. Signet selects Server by default; an outage reports its cause and permits explicit Direct selection for independent new work, never a silent replay or signer replacement. The release must not disable a previously enabled feature to satisfy parity.

Treasure contract validation and wallet signing source are separate. Both required workflows use the previously approved real Browser validation path, subject to each network's actual funding/spend evidence. Unsupported stronger contract modes and hosted Mutinynet signing are outside this release. Their missing qualification remains documented, not marked passed. `qualify-bis-server-two-network-readiness` remains a deferred future hosted-network change.

The finite order is: freeze the feature/budget checklist; implement network routing and header; prove Direct Mutinynet; prove Server Signet; freeze and export one verified immutable integration candidate for local game integration; complete both game workflows on that exact artifact; publish matching BIS/game releases; verify public routes and close only evidenced tasks. See design.md and tasks.md for owners and exit criteria.

Local candidate export/import requires frozen source, passing package checks and exact provenance. It does not require prior Pages publication and does not claim final live acceptance. Final acceptance and publication require the same immutable candidate to pass both required workflows. Changed packed bytes require a new candidate and affected checks; no source-folder dependencies or silent repacking.

## Execution takeover, 2026-10-29

Confirmed Production authorization: the human selected option 1 in Grill Question 1, explicitly approving `BIS_PUBLIC_SETTLEMENT_SIGNING=true`, `BIS_PUBLIC_CONTRACT_SIGNING=true` and `BIS_PUBLIC_ASSET_SIGNING=true` in the existing Vercel Production service for Signet only. Preserve existing grants, recipient checks, signer keys, access protections, 5,000-sat operation and 10,000-sat daily limits. This permission is not evidence that configuration or live acceptance has passed. The human then ended the interview and explicitly requested complete implementation and deployment without further routine permission stops.

The user requested replacement ownership, minimum calendar time and a two-hour completion target. Reuse this change and its acceptance criteria; do not restart its implementation or migrate unfinished requirements into a nominally completed replacement. The server/BIS execution chat owns this change under the current takeover section of the BIS program ledger.

Finish current Signet signing, manual fallback, Admin/Marketplace release and the verified integration archive. The Treasure/game owner performs the adjacent-game import and release portions of 5.3–5.5 after the BIS acceptance gate is satisfied.

The local integration-candidate gate is frozen source, package verification and exact provenance. Tasks 5.1 and 5.5 still require real acceptance, and 5.2/5.4 still require verified publication before final completion. Publication is not a prerequisite for local candidate import.

The execution target ends at 15:28 UTC on 2026-10-29. This target does not waive live evidence, spending limits or uncertain-operation preservation. Report an exact external blocker once, continue independent authorized work, and reopen the blocked action only when its recorded prerequisite changes.

This release delivers Server on Signet and Direct on Mutinynet across BIS and Stealth & Steel. The [hosted two-network follow-up](../qualify-bis-server-two-network-readiness/proposal.md) is deferred and does not block Direct Mutinynet.

## Why

Players currently configure a second browser wallet to exercise Game Wallet features. A server-held game signer removes that setup in local development and published demos while retaining the existing manual login whenever no running server can be found.

## What Changes

- Create `BIS/packages/bis-server`, package `@bis/bis-server`, to own only the Game Wallet signing identity. Keep Player Wallet signing and existing game workflows in the browser.
- Load the game mnemonic from server-only `.env.local` locally and private environment configuration on Vercel. Return public identity and signatures, never the mnemonic.
- Support the same signing handlers through the root Vite server for local testing/debugging and through Vercel for published clients. The adjacent game uses its Vite origin with a local proxy or middleware.
- Resolve the known local API during development and a configured Vercel API in Pages builds. Probe at initialization and player login/logout. If no server is running/findable after a bounded attempt, offer existing manual Game Wallet Login, including when the endpoint was configured.
- Display `Server` or `Direct` in the upper-left of the shared header after network selection. Retain network/version and show connection health separately. Source changes affect new work only; existing operations retain their original signer and recovery records.
- Include the minimal hosted authorization, signing-session state and wallet coordination required for Vercel correctness now. Keep transaction preparation, submission, operation journals and reconciliation in the browser. Configure and enable the hosted signer for Signet only; Mutinynet must report unavailable and retain explicit manual fallback.
- Export a verified immutable local candidate, integrate it in Stealth & Steel, and prove both required workflows before publishing matching BIS Admin, Marketplace and game releases. Final completion requires public mode labels, complete Direct Mutinynet behavior and Server Signet behavior, plus explicit safe fallback.

## Capabilities

### New Capabilities

- `bis-server-game-wallet`: Private local/hosted Signet Game Wallet signing, source resolution with explicit manual fallback, signing parity and source-bound recovery.

### Modified Capabilities

- `user-facing-game-wallet`: Source-aware Developer Settings, manual fallback and banner indicator.
- `admin-game-wallet`: Server-source exceptions to local identity import and lifecycle rules.
- `multi-package-development`: Same-Vite handlers, secret isolation, local/Pages backend selection and package documentation.
- `pages-demo-deployment`: Signet Vercel-backed Admin/Marketplace release and separately published matching game consumer.

## Impact

Targets integration Game Wallet composition, Arkade identity/session adapters, shared account shell, Admin/Marketplace consumers, root Vite tooling, bis-server deployment, and the adjacent game's vendored BIS package, account routing, Treasure gate and release metadata. Hosted signing is Signet-only; Mutinynet Direct remains fully in scope. Unrelated gameplay and unfinished feature proposals are excluded.

SDK 0.4.79 exposes public keys, transaction/message signing and stateful signer sessions. Remote compatibility and Vercel restart/concurrency behavior must be proven; this proposal does not claim they already work. The no-custom-server project constraint receives a scoped exception for the game signer. Existing fee payer, trophy eligibility and gameplay rules remain unchanged.

Implementation defaults are `/api/bis/`, a Signet test-wallet identity, and a serverless-compatible store for signing-session/coordination metadata. The existing multi-network implementation may remain, but this release configures and exposes only Signet signing. Hosted Mutinynet wallet selection, funding and signing acceptance belong to the deferred proposal 2; Direct Mutinynet feature acceptance is required now. Provider/project URLs and private credentials are deployment inputs to obtain privately during apply. A reachable but incompatible/unauthorized server reports its error rather than masquerading as an absent server.

Complete this two-workflow release before future hosted Mutinynet work. Direct Mutinynet regression and real Browser validation acceptance belong to this release and the linked Treasure changes. Full-operation server execution remains separately deferred to `host-bis-server-game-wallet`.
