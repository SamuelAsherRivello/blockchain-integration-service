# bis-server deployment status and operator guide

## Current state

Milestone 1 remains in progress. The initial isolated Node 24 deployment is
`https://bis-server-rho.vercel.app`, project `bis-server` in Asher's projects.
Vercel Deployment Protection remains enabled. This deployment verifies private
configuration, Redis availability, public identities and domain-separated
cryptographic proofs. It is **not yet the public game-wallet signing release**.

The production health endpoint reports `publicSigning: false`. Anonymous
`connect`, signing grants and arbitrary signing are denied. Public Pages clients
must not be configured to use this endpoint as if normal gameplay signing were
ready. The BIS source now contains scoped payment/asset policies, including
Player-authorized issuance, delivery and burn, plus the approved exposure caps;
these changes are local and have not been deployed. Deployed public signing,
funded workflow acceptance and consumer releases remain pending.

On 2026-10-22, a read-only production-origin probe returned health HTTP 200 with
`storage: ready`, `publicSigning: false`, `ownerSigning: true`, and all three
wallet slots present for Signet and Mutinynet. An `OPTIONS` preflight from the
GitHub Pages origin returned 204 and the expected `Access-Control-Allow-Origin`
and methods. This proves the stable production URL and CORS path are reachable;
it does not prove an anonymous player can connect or sign, and no signing
configuration was changed. The Vercel connector's project-detail read was
denied by team scope; the CLI confirmed project `bis-server` belongs to Asher's
projects, while the project API omitted protection-scope fields. The actual
protection setting and a real browser request remain to be checked before
release.

### Public production access without paid deployment protection

The Pages client must call the stable production domain directly. It cannot
send Vercel's project-wide protection-bypass secret: that would disclose an
operator credential in public JavaScript and defeat deployment protection.
For a public API on the requested Hobby tier, use Vercel's all-plan Standard
Protection scope, which protects preview/deployment URLs while leaving the
production domain public. Keep preview deployments protected, use the stable
production alias in `VITE_BIS_SERVER_URL`, and independently verify the health
route, CORS preflight and anonymous `/connect` from a browser origin before
enabling public signing. Owner routes remain protected by `BIS_OWNER_TOKEN`
and narrowly scoped signing grants; deployment protection is not application
authorization. If the account's current project setting is All Deployments,
the production API will remain inaccessible to Pages until the scope is
changed. Do not upgrade the plan or expose a bypass secret to work around it.

This follows the [Vercel Deployment Protection plan/scope behavior](https://vercel.com/docs/deployment-protection)
and [automation-bypass guidance](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection):
the documented bypass secret is for trusted server-side automation, not a
browser client. The actual `bis-server` protection setting still needs a
read-only account check and a live browser-origin probe before release.

## Private wallet configuration

Set these six variables as Production Secrets in the Vercel project settings:

```text
BIS_GAME_WALLET_SIGNET_01_MNEMONIC
BIS_GAME_WALLET_SIGNET_02_MNEMONIC
BIS_GAME_WALLET_SIGNET_03_MNEMONIC
BIS_GAME_WALLET_MUTINYNET_01_MNEMONIC
BIS_GAME_WALLET_MUTINYNET_02_MNEMONIC
BIS_GAME_WALLET_MUTINYNET_03_MNEMONIC
```

Values stay in Vercel runtime configuration. Do not paste them into chat, CLI
arguments, URLs, reports, browser variables or source. Production Secrets must
not be pulled into the local development environment. Use separate local and
Preview wallets. Locally populate the ignored package `.env.local` privately;
the legacy single-wallet variable remains supported only by local development.

Within the requested network, the pool considers `01`, `02`, then `03`. It skips
missing or malformed mnemonics and duplicate public identities. A requested
minimum balance requires a fresh network-backed balance check. Unknown balances
are not eligibility evidence. Confirmed Bitcoin balance and Arkade-spendable
balance are distinct requirements. A zero-minimum identity probe can choose an
unfunded wallet so it remains possible to receive funds.

Selection occurs before creating a signing session. Every subsequent signing
request resolves the exact original network/profile; a balance change cannot
move a pending operation to another wallet. New independent work may select a
different eligible wallet. No cross-network fallback is allowed.

Local and hosted `/connect` also accept an exact original `profileId`, without a
balance requirement. This resolves the original slot even if it is now empty;
an unavailable profile fails instead of selecting a replacement. The client
checks the returned profile as well as its public-key binding. Refresh keeps a
separate profile per network. A public profile ID persists across reloads under
an endpoint/game/network-scoped browser key, never beside credentials or plans.
Unreadable or unwritable selection metadata reports an explicit source error.
The client now requests a fresh 1,000 available-Arkade-sat minimum when its
initial selected server wallet is below that threshold. A new player payment
rechecks priority using the requested amount. The existing client quote still
validates the final transaction and fees. Neither path treats confirmed Bitcoin
as Arkade funds. Balance selection has a separate 15-second request deadline;
its failure keeps the original compatible signer and reports unavailable funds,
not an absent backend. Only the short reachability probe controls manual fallback.

Before and after selection, the real composition checks the current lifecycle,
Player/Game separation, unresolved records and active SDK signing. Cancelling
the caller does not release an unfinished SDK lease. A late result cannot change
the network or overwrite a newer probe/selection. Successful promotion updates
the public remembered profile and retires old client reads before a new payment.
Existing recovery actions continue using the original identity without selection.

Pending Marketplace checkouts also pin the Game Wallet before their lower-level
send/delivery journals exist. New selection checks these records before and
after asynchronous work. Marketplace sell payout passes its checkout ID to
`payPlayer`, which checks the pending phase, exact wallet/address/player and
amount before using the original signer. Buy delivery uses its operation ID to
validate the analogous checkout scope. These browser records preserve workflow
ownership; they are not server-verifiable payment or delivery authorization.

Deterministic controller/hosted and browser tests prove slot-02 selection,
priority rechecking, empty original-wallet retention during pending work,
selection failures without manual fallback, network replacement and reload.
These tests use injected balances and do not prove funded network acceptance.
Mint availability/new mint selection now uses the fresh SDK wallet dust minimum.
Boarding quote selection uses the operator's current VTXO minimum against
confirmed boarding Bitcoin. Missing, zero or malformed minimum facts do not
qualify a candidate. The existing client quote still checks fees, limits and
exact inputs; selection is not permission to sign or confirmation of boarding.
An existing mint operation ID bypasses selection and reaches only the original
adapter for its normal request validation/reconciliation. Boarding submission
and recovery likewise keep the identity in the reviewed quote.

New delivery and burn selection requires the requested asset in fresh spendable
SDK outputs, excluding recoverable and unrolled outputs. Quantities remain exact
bigint strings, not floating-point numbers. Delivery requires enough units;
burn requires the exact quantity expected by the current burn adapter. Both
require the SDK carrier minimum. Unknown holdings cannot qualify, even if the
candidate has more Bitcoin. Existing delivery/burn operation IDs bypass selection
and keep the original journal and adapter.

The real composition sends the Player profile as an excluded candidate. Pools
skip it before balance reads, including identity-only selection. If the initial
server identity equals the Player, the client can select a separate candidate
before enabling Game Wallet operations, subject to the same pending-work guards.
Post-selection checks still reject role, network or lifecycle changes.

Legacy single-mnemonic local configuration remains supported as a one-candidate
pool for balance/asset checks. It cannot invent a fallback identity or ignore a
requirement. These selection tests are deterministic; live signing and network
acceptance remain separate gates.

## Free-tier infrastructure

The project uses the existing Vercel Hobby plan and the Marketplace Redis
resource `bis-server-signing-state` on billing plan `free`. Provisioning explicitly
set `primaryRegion=iad1`, `autoUpgrade=false`, `eviction=false` and `prodPack=false`.
No paid upgrades or production pack were requested. Quota exhaustion must stop
requests, not authorize eviction or upgrade. Hobby is restricted to personal,
non-commercial use. Recheck eligibility before changing how the demo is used.

Current references: [Vercel Hobby](https://vercel.com/docs/plans/hobby),
[Upstash pricing](https://upstash.com/pricing/redis).

## Signing authorization and coordination

Privileged testing additionally requires `BIS_OWNER_TOKEN`, a new random
Production Secret of at least 32 characters, entered privately by the operator.
The operator has saved this secret and runtime health has confirmed it is configured.
Never reuse a mnemonic as this token. Missing owner configuration fails closed.
It is not a public player credential and must not appear in a Pages build.

Owner grant issuance binds game ID, network, profile ID, operation ID and the
SHA-256 digest of the exact signing request. Grants expire after one minute.
The signing endpoint also needs the original signed, ten-minute connection token.
Its game/network/profile scope is verifiable across instances without process memory. The
browser adapter can receive an owner token explicitly at runtime through
`configureBisServer`; it never persists that value or reads it from `VITE_`.
Clearing or replacing it also clears credentials cached by existing signing
adapters. A new successful probe is required before owner signing resumes.
Developer Settings now provides an operator-only owner-access disclosure when a
configured HTTPS signer is connected or reports an access/configuration error.
It displays the exact destination, accepts the token in a password input, clears
the field on submission and offers Forget owner access. It does not store the
token in localStorage or sessionStorage. Reloading removes access. A real browser
test uses the hosted handler with a disposable credential to verify connection,
forgetting, reload and storage isolation. Do not give this credential to players.
This control authorizes the existing owner grant path; it does not enable public
gameplay signing or remove the need for server policies and spending caps.

The approved maximums are 10,000 test sats/day per network and 5,000 sats per
operation. The two non-secret Vercel settings are `BIS_SIGNING_DAILY_CAP_SATS`
and `BIS_SIGNING_OPERATION_CAP_SATS`. The retained client now uses a separately
authenticated owner plan for offchain transactions. The server verifies fresh
Game inputs and reconstructs the exact root/checkpoints, subtracting only
server-derived Game change. Generic asset minting remains owner-authorized and
can have zero Bitcoin exposure. Carrier outputs, external payments and fees
remain within the spending caps. Owner plans and grants use separate HMAC domains
from public Player plans, and require current owner access at signing too.
The legacy owner method path still conservatively counts full input/tree value
where an offchain plan is unavailable. Boarding, contract-input and settlement
parity remain incomplete; this partial correction is not full workflow parity.
Daily quota is shared across wallet slots; fallback does not reset it.

Redis primary-side Lua claims atomically reserve request IDs, input outpoints,
quotas and the wallet lock before signing. Successful results commit before the
lock is released. Changed replay and conflicting transactions are refused.
Reservations do not expire. A crash or uncertain persistence leaves the wallet
quarantined; elapsed time alone cannot unlock it. There is deliberately no
automatic force-unlock endpoint. Reconciliation and an explicit operator recovery
procedure are required before a quarantined wallet can sign again.

SDK secret nonce state is encrypted with AES-256-GCM before Redis persistence.
Authenticated binding includes game/network/profile, connection, operation and
session ID. The encryption key derives from the private owner credential with a
separate signing-session domain. Rotation invalidates existing connections and
sessions. The private codec checks the exact pinned SDK 0.4.79 state layout and
refuses an unexpected layout. It never sends a private snapshot to clients.

Session reads and writes require the acquired wallet claim and execute through
Redis primary-side Lua. Mutations persist before committing the reply. Redis
expires encrypted blobs after ten minutes; the authenticated absolute deadline
prevents a write from extending a session. Missing, altered, expired or incorrectly
bound state fails closed. Wallet claims and input reservations never expire with
the blob. Deterministic tests complete a real two-party MuSig signature while
constructing a fresh handler for every exchange, verify exact cold-instance replay,
and exercise lost-state and failed-persistence refusals. Live checks against the
provisioned Redis now verify primary-side Lua replay/input exclusion, cross-slot
budgets, concurrency, crash quarantine and an encrypted MuSig session using fresh
HTTP handlers and Redis clients on every exchange. Missing, corrupted, wrongly
bound, expired and failed-persistence sessions refuse signing. These checks use
unfunded public fixtures, not production wallet mnemonics or funded transactions.
The same candidate bundle also passed acceptance across two separate protected
Vercel Preview deployments. Actual signing exchanges alternated deployments.
Concurrent requests converged on the original committed result, changed retries
and conflicting inputs were refused, and a transaction input signature matched
the local SDK. A complete two-party MuSig aggregate verified across deployments.
Deleting encrypted session state caused signing refusal and retained the wallet
claim across deployments. This closes coordination task 4.2, not public signing
or funded workflow acceptance. The sanitized evidence is
`output/reports/bis-server/milestone-1/vercel-instance-verification.json`.

The acceptance verifier uses an isolated free, 72-hour Upstash scratch database
and temporary Preview credentials. It never supplies Preview with production
datastore access or wallet secrets. It removes exact test keys, variables and
disposable deployments afterward. Failed verifier iterations were not counted as
acceptance; the final report records both actual signing deployments and cleanup.

## Build and verification

### Current policy implementation boundary

The retained remote SDK identity now takes its operation ID from the exclusive
application-wallet lease. Several signatures within that lease share one ID;
the next operation receives a new one. Cancellation does not release the lane
until the actual SDK callback finishes. An old signer session cannot migrate to
the next operation.

Player authentication has a typed, domain-separated challenge and local Schnorr
proof. It binds the HTTPS backend origin, game, network, selected game profile,
operation and player public key. The server never receives the player mnemonic.
These player credentials are not owner grants or signing connections. The
hosted routes still refuse public signing, including requests carrying a valid
player proof unless the experimental payment policy is explicitly enabled.
The proof capability now uses the private app account-storage composition. It
checks Player scope and storage generation around authentication and retains a
scope guard through grant issuance and signing. Logout cannot turn a late grant
response into a signature request for the replacement scope.

An internal ordinary-payment validator reconstructs the real SDK root and
checkpoints from trusted inputs and recipient/change scripts. It rejects asset
inputs, arbitrary outputs, altered witness values, sighashes and script paths.
Its exposure calculation includes the recipient and fee, not verified change.
`payment-context.ts` reads original outpoints from the configured network's
indexer and derives the Game and Player scripts from operator configuration and
verified public keys. It refuses spent/expired/unrolled/foreign/asset-bearing
coins, missing or duplicate answers, wrong networks and unsafe checkpoint delays.
The validator and fresh-context reader are now connected to experimental
`payment/plan` and `payment/authorize` handlers. These require a scoped Player
proof and an existing connection. `/sign` verifies the exact payment grant and
sealed canonical plan, then claims its source inputs and linked net exposure
atomically. Root and checkpoint signatures verify with the real SDK across
fresh handler instances in deterministic tests. Plans contain only public
transaction data and travel in JSON bodies, not headers. Tampering, changed
requests, another connection and expiry are refused before a signing claim.

This ordinary-payment path is off unless the private server configuration sets
`BIS_PUBLIC_PAYMENT_SIGNING=true` and explicitly lists allowed test networks in
`BIS_PUBLIC_SIGNING_NETWORKS` (comma-separated `signet` and/or `mutinynet`).
Owner-authenticated connection, planning, authorization, signing, and completed-
result recovery use `BIS_OWNER_SIGNING_NETWORKS` when it is set; otherwise they
inherit `BIS_PUBLIC_SIGNING_NETWORKS` and fail closed if no valid network list
exists. This keeps Production Mutinynet unavailable even with an owner token,
while Preview may opt in by setting `BIS_PREVIEW_OWNER_SIGNING_NETWORKS` to its
approved test-network list. The owner allowlist does not widen public signing.
When `VERCEL_ENV=preview`, public signing reads only the isolated
`BIS_PREVIEW_PUBLIC_PAYMENT_SIGNING` and `BIS_PREVIEW_PUBLIC_SIGNING_NETWORKS`
values, while owner signing reads only `BIS_PREVIEW_OWNER_SIGNING_NETWORKS` when
configured (or falls back to the Preview public allowlist). Proposal 1 must list
`signet` only and keep public settlement, contract and asset policies disabled
for the Signet-only rollout. The approved Production values are configured, but
take effect only when the deployed bundle contains these allowlist-aware
handlers. Public connections, identity capabilities, health status and payment
signing all reflect the network allowlist. Verify `publicSigning` and Signet
identity capabilities after deployment; Mutinynet must remain unavailable. The
separate deployment-proof route provides only a domain-separated Signet identity
proof; it does not enable Mutinynet signing. Funded Signet workflow acceptance
remains a separate release gate. The retained client-wallet path now
captures original input references around `buildAndSubmitOffchainTx`, obtains a
sealed plan for the root and reuses it for checkpoints. Tests exercise the real
client adapter and hosted handler from an anonymous connection, without an owner
credential. Connections consume the shared public quota and do not grant signing
authority. Explicit invalid owner credentials are rejected rather than ignored.
These are deterministic tests, not evidence that a public player can sign a
funded Signet operation. Private Player data, proofs and plan references are not
added to the public BIS API or browser persistence.

The Redis claim accepts an optional server-selected exposure group for linked
protocol transactions. Atomic accounting charges the group once, checks its
original amount on subsequent requests and binds it to the wallet and operation.
Clients cannot select this group through the current hosted API. Live Redis
verification covers changed exposure and attempted reuse across operations or
wallet slots. These are signing-policy components, not funded-workflow evidence.

The internal asset-policy validator now reconstructs real SDK NFT issuance and
delivery. Public issuance is limited to one non-reissuable unit with BIS metadata,
retained at the Game address. Existing assets and Bitcoin change must be preserved.
Delivery requires a server-authorized asset ID, sends one unit only to the
verified Player script, preserves unrelated holdings and caps carrier plus fees.
It refuses burns, reissuance, arbitrary destinations and quantity changes.
These restrictions describe the public policy case, not a replacement for
privately authenticated generic Admin minting.

The shared ledger can bind a server-validated issuance asset ID to its Player
public key. Authorization is committed atomically with the signing result and
read on Redis's primary. Another Player, network or wallet profile cannot reuse
it. Failed or unresolved signing does not create authorization. This record is
permission metadata, not proof that minting completed on Arkade. Fresh network
ownership remains necessary before any delivery.

These asset components now use the hosted sealed-plan/grant path when the private
experimental `BIS_PUBLIC_ASSET_SIGNING` flag is enabled alongside the payment
flag. Fresh context validates typed network holdings. Issuance records are
committed only with a root signature, not a checkpoint signature. Delivery checks
the Player-bound primary-side record. Zero-net-exposure is accepted only for an
explicit validated issuance plan. Disabling the asset flag refuses previously
issued asset grants too. A sats payment may preserve unknown assets in Game
change without gaining permission to deliver them.

Public connection, plan, grant and signing requests consume a shared Redis quota of 60 per
minute and 600 per UTC day per game/network, across all wallet slots. The check
runs before wallet selection for anonymous connections and after credential
validation for financial requests, before preparation reads or signing claims.
It returns HTTP 429 on exhaustion. Even zero-cost issuance consumes quota; BTC
caps remain independently enforced. Only these expiring quota counters expire,
not unresolved signing reservations. Production flags remain off. Public
connection issuance is implemented locally; other workflow parity and live
acceptance are still incomplete.

SDK 0.4.79 lacks a public AssetGroup
metadata iterator, so the validator checks its pinned metadata representation
and proves exact public serialization after reconstruction. Its real-SDK tests
must gate SDK upgrades. None of this enables production signing or establishes
funded acceptance.

From the repository root:

```text
npm run test --workspace @bis/bis-server
npx tsc --project BIS/packages/bis-server/tsconfig.json
npm run typecheck
npm run build:deployment --workspace @bis/bis-server
```

For live Redis acceptance, run from `BIS/packages/bis-server` with Vercel's
environment injection. The script consumes only the datastore credentials and
uses generated owner credentials plus a public, unfunded BIP39 fixture. It never
uses a production wallet or pulls a Production Secret. Each run has unique game
scopes, removes only its exact recorded keys, and writes a sanitized
`redis-verification.json` report under the milestone's output directory.

```text
vercel env run --environment production -- node scripts/verify-redis.ts
```

If the Windows PowerShell npm shim drops `--`, invoke the installed Vercel CLI
JavaScript entry through Node with the same arguments. Do not use debug logging,
print the injected environment, or redirect credentials into a report.

For isolated deployed-instance acceptance, first build the server, then run from
the package directory:

```text
node scripts/verify-vercel-instances.ts <installed-vercel-cli-entry.js>
```

This command creates and removes two protected Preview deployments. It refuses
to overwrite existing Preview configuration. Review the project/team link first.
It keeps generated test credentials and protected curl configuration in process
memory, passes them through stdin, and withholds raw CLI stderr. The scratch
service is documented at [Upstash CLI](https://upstash.com/docs/agent-resources/cli).

The deployment build writes only a bundled server function, a static readiness
notice and deployment metadata under the ignored package `dist/deployment`.
Private environment files and frontend applications are not copied. Verify
`vercel project inspect --non-interactive` from that directory before deploying.
Deployment metadata is copied only for the explicitly approved project/team.

Use `vercel curl` for protected requests. Avoid short `-d` data flags in CLI
wrappers: the installed CLI can interpret them as its global debug option and
log protection credentials. The verification script uses `--data-raw`, captures
stderr privately and writes only sanitized public results under repository-root
`output/reports/bis-server/milestone-1/`.

Hosted proofs verify real signatures under the deployed identities and exercise
Redis. They are not funded Arkade transaction evidence. No faucet request or
financial transaction is implied by a passing proof. Signet faucet permission is
limited to wallet 01 and a maximum of 10,000 test sats; no funding has occurred in
this deployment step.

## Marketplace payment receipt validation in development

`marketplace-payment-receipt.ts` is a read-only verifier used by the local hosted
adapter's opt-in payment-plan policy. It reads immutable asset metadata and the fixed BIS equipment definition
to derive price, never a browser price field. It derives Player/Game scripts
from the verified public keys and the selected operator's current network data.
Indexed root/checkpoint bytes and spent source outputs must reconstruct the
exact SDK Player-to-Game payment, including Player asset change. A same-value
output funded by somebody else is not an acceptable Player receipt. Partial,
wrong-network, malformed or interrupted answers remain unverified. The asset's
genesis must also reconstruct a one-unit non-reissuable Game-owned issuance.
Every indexed metadata field must match that actual issuance packet. A Player
cannot fabricate issuer authority by copying catalog labels.

Sealed Player signing plans can carry one typed payment-receipt reservation.
Root and checkpoint claims reserve it against the same fulfillment transaction;
a different fulfillment conflicts with that reservation. Deterministic tests
cover the sealed claims and hosted handler. Real Redis primary-side tests verify
receipt exclusion and linked steps using isolated unfunded fixture scopes.
Private client composition supplies only the payment transaction reference from
an exact pending checkout and selected delivery inputs. The server independently
verifies it; neither the local checkout nor its price is signing authority.

This receipt check does not authorize a giveaway, validate a sell-back delivery,
submit a transaction or complete a checkout. Sell-back policy and live financial
acceptance remain required before enabling production catalog signing. Issuer,
handler and client tests do not substitute for that acceptance.
Incoming Player payments are not Game spending. The operator subsequently
approved a 5,000-test-sat outgoing operation maximum, with the 10,000-sat daily
network maximum unchanged. Local validators share those ceilings. Configuration
may lower them but cannot exceed them. Root/checkpoint plans bind one exposure
ID so linked signatures do not charge the same spend twice. The existing live
deployment remains at its earlier 1,000-sat configuration until compatible code
and configuration are deployed together. This approval does not enable public
catalog signing or prove a live purchase or sell-back.

### Standard LTO signing policy, local implementation

The opt-in `BIS_PUBLIC_CONTRACT_SIGNING` policy covers the existing standard
Player/Game hashlock's funding and refund signatures. It also requires public
payment signing to be enabled. This flag is not enabled in Production.
The server reconstructs the contract from verified Game/Player keys, fresh
operator parameters and a public SHA-256 hash. It checks fresh source outputs,
reconstructs the exact SDK root/checkpoints and enforces the same 5,000-sat
operation and 10,000-sat daily/network limits. Funding retains unrelated assets
at Game change. Refunds return only to the Game, with fees counted as exposure.
The Player's ordinary claim signatures remain local.

The browser's direct LTO adapter now borrows the app's exclusive Game signer
lease and captures the original inputs and public contract scope before any
SDK signature. The client still prepares, journals, submits and reconciles the
operation. No recovery preimage is sent to bis-server. Private owner recovery
may supply the original public Player key without impersonating that Player;
the server still checks the contract's actual source script and Game-only
refund destination. Owner plans remain separate from public grants.

Deterministic tests exercise real scripts/signatures, fee boundaries, altered
recipients, wrong Player/network, metadata capture before signing, lease expiry
and flag revocation. Provider facts are injected in these tests. They are not
evidence of a funded contract or live Arkade acceptance. Treasure covenant
signing and boarding/settlement policies remain incomplete and block milestone
completion. Do not disable those existing actions to claim parity.

### Settlement proof transport, local implementation

The hosted handler now has `/api/bis/settlement/plan` and
`/api/bis/settlement/authorize`, with separate owner routes under
`/api/bis/owner/settlement/`. Public access requires both
`BIS_PUBLIC_PAYMENT_SIGNING=true` and `BIS_PUBLIC_SETTLEMENT_SIGNING=true`,
plus a scoped Player proof. The new settlement flag remains disabled in
Production. Owner routes require the private owner credential and the original
connection token. Public and owner plan/grant signatures use separate domains.

Planning reads fresh Game sources and validates the actual SDK registration
proof. The resulting plan permits only that exact registration and its exact
delete/status ownership proofs. `/api/bis/sign` verifies the grant against the
whole request, including PSBT metadata, before obtaining an atomic signing
claim. All three proofs retain the original inputs and one logical reservation
and exposure ID. The reservation ID is not a network transaction receipt.
Neither a plan nor a signature establishes successful boarding.

Cold-handler tests verify real signatures and reject changed requests, missing
owner authority, invalid Player proofs and revoked public policy before signing.
These tests inject provider facts and capture store claims. They do not prove
live operator acceptance or replace Redis accounting tests. Client integration
and validated batch/tree/commitment authority remain required for full settlement
support. The proof routes grant no MuSig authority and must not be presented as
completed boarding parity.

The retained Game client now captures explicit `settle` parameters before SDK
work and constructs a detached SDK registration proof, including retained asset
quantities. Concurrent register/delete requests share one in-flight plan Promise.
Public requests use the current Player proof; owner requests use the private
credential without sending it in the body. The hosted SDK session public-key
lookup requests the original scoped plan and its derived session key before
the SDK constructs its registration proof. Local Vite uses the existing SDK
session lookup and its own session key. The hosted key lookup does not create
a remote MuSig session. Game wallet-input signing retains the Game key.
Session handles remain bound to their original lease and settlement scope.

Batch/session signing still refuses an unvalidated settlement rather than
falling back to the legacy generic owner grant. Explicit plans remain required;
implicit SDK `settle()` selection is not implemented for server signing. These
are remaining parity gates, not a completed boarding implementation. Current
browser transfer paths supply explicit parameters. Local/manual signing and
Player signing keep their existing paths.

Server-only batch validation now checks the SDK tree/recipient rules and also
checks that the root aggregate key matches the commitment's shared output.
It verifies the expected sweep script, original Bitcoin input inclusion, Game
recipients and exact asset quantities. Traversal rejects cycles, duplicate nodes
and oversized graphs before recursive SDK validation. Shared batch value may
include other participants and is not the Game's spending exposure.

Those structural checks cannot alone distinguish a new batch from an older
shared output signed by the same wallet key. A separate server-private session
identity derivation now binds an original canonical draft to its connection,
operation and network. It provides only public-key and SDK session methods, not
general transaction signing or private-key export. Repeated derivation for the
same draft/scope is stable across instances; changed drafts/scopes get different
keys. The draft uses the Game key as the placeholder cosigner before substitution,
so derivation is not self-referential. Game wallet-input and ownership-proof
signatures must continue to use the actual Game identity.

The derived session key and actual registration are now sealed into operation
plans through the explicit `operation-v1` session-key mode. The server validates
the Game-key draft against fresh sources, derives the session key itself and
reconstructs the actual registration. The client cannot substitute a declared
session key. Exact register/delete/status grants share the original reservation.
Legacy proof-only plans remain unable to supply a session identity.

Hosted batch grants now bind the batch to that sealed plan and use the
encrypted session/replay rules. Browser batch-context capture is wired locally;
settlement finalization policy remains incomplete. Current tests verify SDK structures and
real MuSig aggregate signatures with public fixtures, not live settlement.
Production signing flags remain unchanged.

The Redis signing ledger now supports an atomic settlement batch binding. A
server-validated claim can pin one batch digest to its original reservation,
which must also be its transaction/exposure group. Linked session steps retain
that digest and charge the original exposure once. Another batch is refused
before signing, even if it uses a new request or session ID. Exact replay and
completion also check the binding. Budget refusal does not create one; a crash
after acquisition retains it. The binding shares the existing permanent ledger
and requires no additional datastore or operation journal.

Real Redis fixture tests verify these rules, network isolation, existing caps,
encrypted sessions and nonce protections. The fixture uses public, unfunded
identities and random test scopes; it deletes only its exact test keys. This
does not establish funded workflow acceptance or deploy the new policy. Hosted
batch grants now produce this metadata before session initialization.

The private encrypted-session codec now accepts an operation-session capability.
It binds encrypted state to the original settlement reservation, checks the
restored session public key against the sealed key, and stores the validated
batch digest at initialization. Later phases reject a changed or omitted batch
binding. Legacy encrypted sessions remain separate through authenticated
encryption context; they cannot be substituted into the operation-bound path.
Hosted batch grants supply this internal capability after verifying the original
plan, scope and request. It is never accepted as a client-declared identity.

SDK 0.4.79 creates a random key in `signerSession()`, independent of its wallet
key. The server therefore uses its existing version-checked private SDK codec
to install the derived key only into a fresh, uninitialized session. It rejects
layout changes or already-used sessions before modifying their key. Tests now
check the actual SDK session public key against the sealed key, in addition to
verifying aggregate signatures and encrypted restoration. The local HTTP path
also verifies real aggregation while retaining its ordinary SDK session key.
Neither result is live operator settlement acceptance.

### Batch and session grant routes, local implementation

`/api/bis/settlement/batch` validates the candidate against the original sealed
registration. It reads operator/sweep keys from the fixed network endpoint with
a bounded read, never a client URL. It enforces the SDK expiry floor and any
advertised expiry. Only exact registered Game recipients/assets and original
Bitcoin inputs qualify. The result is a sealed batch token, not a registration
or financial receipt. The atomic ledger pins the first batch used for signing.

`/api/bis/settlement/session/authorize` issues an exact-request grant for supported
session methods. Initialization binds the complete tree digest, sweep root and
shared amount. Later nonce requests bind known transaction IDs and cosigner
keys, and validate public nonce point encoding before a claim. Private nonce
fields are refused. Session grants cannot authorize ordinary transactions or
ownership-proof signing. Owner equivalents live under `/api/bis/owner/` and use
separate signing domains and private owner authentication. Public routes still
require both opt-in flags, a connection and a scoped Player proof.

Cold-handler tests complete real Game ownership signatures and operation-key
MuSig aggregation for both authorization modes. They verify exact response replay,
replacement-batch rejection before state writes, revoked access before claims,
and one original fee exposure despite the larger shared batch value. Provider
facts and ledger behavior are injected in these tests. Real Redis coordination
has separate evidence; funded operator/Vercel acceptance remains pending.

The retained browser wallet now captures SDK batch-start and tree-signing events
synchronously, before the SDK's unawaited callback returns. It selects only the
original operation's derived session key, retains the batch ID/expiry and a
detached commitment, and bounds stored events and payload size. A missing start,
changed expiry, duplicate cosigner or replacement candidate records a permanent
refusal for that settlement. The observer still receives its original events;
preparation, submission, journals and reconciliation remain browser-owned.

Hosted session initialization obtains one batch token through the scoped batch
route. Initialization and later nonce/signature requests use exact session grants
and retain that token, connection and operation. Missing batch authority fails
before remote session creation, without a generic owner-grant fallback. Local
Vite keeps the SDK's ordinary session path. Public and owner client tests invoke
the callback without awaiting it and complete real two-party MuSig signatures
across fresh HTTP handlers. Their provider facts and datastore are fixtures,
not funded operator acceptance. The retained client now captures the original
batch finalization and bounded connector chunks; hosted finalization grants
reconstruct boarding-commitment signatures and connector-bound virtual forfeits
to the configured operator script. Client integration exercises boarding
finalization, while separate policy tests verify virtual-forfeit signatures and
connector conservation. A combined hosted-client virtual-forfeit acceptance,
implicit settlement selection and deployed live workflow acceptance remain
open. Production flags are unchanged, and publication remains held for the
separate Treasure work.

## 2026-10-25 access and focused-suite checkpoint

The current local `@bis/bis-server` test run passed 183/183 tests, including its
Playwright-backed local Vite cases. This is deterministic package evidence, not
funded workflow acceptance. The Playwright cache had to be placed under the
repository's ignored `output/` tree because isolated shell sessions do not share
the default browser cache.

Vercel project discovery lists `bis-server`, but detailed project, deployment,
and environment reads return HTTP 403 for team scope
`ashers-projects-d3be6036`. The connector has prepared a single-use consent link;
team approval is required before those reads can be retried. No Vercel settings,
environment variables, deployments, or stores were changed. Local private
configuration contains an OIDC token key only; no `BIS_GAME_WALLET_*`, Redis,
or signing-cap keys are configured for the local service. Secret values were
not read. Prior preview evidence is tied to an earlier source snapshot and does
not close current deployment or funded acceptance gates. See the dated focused
suite checkpoint in `output/reports/bis-server/milestone-1/` for the exact
command, result, and remaining gates.

Vercel team consent was subsequently restored. On 2026-10-25 the `bis-server`
project and its latest production deployment were readable again. The latest
deployment is READY on Node 24, but it is still attached to source commit
`3c0ac446b2d52edbd1d8037ffbf2c3b7aec4dd0e`, not the reviewed current
workspace candidate. Production environment metadata was inspected with values
kept encrypted: the expected owner, signing-cap, Redis/KV and per-network test
identity key names are present. The two public-signing opt-in keys are absent;
the current source requires both to equal `true`, so this candidate's opt-in
policy remains disabled. No values were decrypted or copied into evidence.

The connected signing-state store reports the Free plan, 500,000 monthly
commands, available status and no exceeded quota. `autoUpgrade` and `prodPack`
are both off. No paid storage or Vercel upgrade was selected. These reads
verify the present account/store configuration only; they do not prove the
current candidate's deployed identity or signing behavior. Do not deploy or
publish this candidate until the coordinator's review and the remaining
settlement, Treasure and live test-network gates are complete.

The deterministic hosted-client acceptance covers SDK virtual-input forfeits
through the client, server policy and signature verification. The shared
app-wallet-session adapter now mirrors the pinned SDK's implicit `settle()`
input selection before creating the server signing plan, and a focused fixture
verifies the no-params call reaches the SDK with the selected plan. This remains
local deterministic evidence. It does not close deployed Vercel identity or
funded-network acceptance. Current focused evidence and the remaining gates are
recorded in `output/reports/bis-server/milestone-1/server-focused-2026-10-25.md`.

## 2026-10-26 Preview secret isolation

The current candidate maps Vercel Preview secrets only from `BIS_PREVIEW_`
variables when `VERCEL_ENV=preview`; it removes corresponding Production names
when a Preview counterpart is absent. Production ignores Preview-prefixed
values. The resolver and sanitized deployment-preflight tests pass, the
milestone-1 focused server suite passes 102/102, root typecheck passes, and the
isolated deployment bundle builds. Bundle SHA-256:
`7507cf9225db3f1845167193c26f1f699f865426a301f2a52abac6e7cd06bcf8`.

This change did not create Preview variables or deployments and did not read,
copy, or upload wallet credentials. It is local security/configuration evidence
only; Vercel plan/quota preflight, protected Preview behavior, deployed-host
identity and signing, Pages release, and funded acceptance remain open. See
`output/reports/bis-server/milestone-1/preview-env-isolation-2026-10-26.json`.
