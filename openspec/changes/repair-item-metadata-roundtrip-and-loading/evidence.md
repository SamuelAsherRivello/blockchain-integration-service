# Repair evidence

## Confirmed metadata regression

Installed Arkade SDK 0.4.72 `castMetadata` rejects arrays, booleans, and null;
BIS previously passed `bisAttributeDeltas` arrays directly to issuance.
The actual SDK encoder test reproduces rejection with the old request and
accepts JSON transport for all nine definitions and an empty trophy array.
The SDK indexer decodes native fields but returns custom metadata as hex.
BIS now hex-decodes, JSON-parses only the structured delta field, and validates
it without deriving gameplay from names or catalog presentation.

## Existing Player holdings

Read-only Mutinynet indexer inspection on 2026-10-11 confirmed these holdings
use v2 operation IDs and contain neither description nor structured deltas:

- Dagger I: `62e63da340fafaa58fb8c6eac9ca02b6ad10f0ce87c7e2f3d3fa2b7a75d2970e0000`.
- Shoes III: `c3a26c2c7c83c3a7dbc6b2a1dd20722d5241e731d67351c74eb35736a469bfad0000`.

Generic Assets therefore displays them while strict equipment classification
returns migration-required. Marketplace now explains this instead of claiming
no holdings. No existing asset was burned or rewritten, and no recovery journal
was cleared.

## Loading lifecycle

Matching Assets/Marketplace presentation reads share the profile/network/role
owner. Shared work has one 30-second deadline and Marketplace a 35-second guard;
failure clears pending work, and a late provider result cannot cache success.
The Assets presentation coordinator uses one attempt. Direct authoritative
listing and transaction ownership checks remain fresh, not presentation-cache
reads. Metadata hydration uses at most four parallel requests. Status updates
no longer automatically restart Marketplace reads; Retry explicitly starts a
new attempt and Cancel dismisses the inventory error.

## Live acceptance (in progress)

Admin and Marketplace were accessed in the already authenticated Edge profile
on `http://127.0.0.1:5174`, without login/logout or recovery phrase inspection.
Both wallet identities were selected on Mutinynet. Admin catalog issuance
has nine succeeded v3 journal records (Shoes I/II/III, Dagger I/II/III,
Shield I/II/III). Dagger III's uncertain original operation was reconciled without
resubmission before issuing Shield I. Its transaction remains
`8a7c5d7b8dbb7fe1bd5f1943ee538630554e6f02ce737d7590d50a9fab439014`;
Shield I's transaction is
`613f46e2904639576acd94e8bbd3e2592f12f75361f7422020a972dfe87d6c89`.
Admin's final batch verification and its separate C.G.4 action both returned
all nine classified items from fresh chain holdings. Marketplace's explicit
Retry subsequently rendered all nine Game Wallet cards with no error/loading
modal. Purchase and gameplay acceptance still require completion; unit tests
are not substitutes for those steps. Diagnostic snapshots are under
`output/playwright/item-repair/`.

## Additional network and storage audit

Legacy Player asset watchers now receive the selected network explicitly,
reject a persisted mismatch, and discard storage completion after a network
change. Game Wallet authoritative listings capture the original operation
signal/scope rather than consulting a replacement signal after awaiting.
Confirmed item mutations invalidate the Game Wallet presentation cache.
Game Wallet preflight storage reads have one bounded 30-second attempt; this
also bounds Admin pending-mint lookup before it acquires a mutation lock.

An authenticated Edge diagnostic observed public IndexedDB selection reads
stalling while crypto digest still completed. A user-approved five-second
foreground diagnostic restored storage access; the window was minimized
again in a finally block. No account envelope or phrase was inspected.

## Verification, 2026-10-11

Production build, typecheck and release-version checks passed. An elevated
full run reported 833/835 passing. The warm-cache Swap fixture lacked the
now-required transfer-recovery adapter; supplying an isolated no-operation
reader made its standalone real-browser test pass. The other failure points
to a separately deleted project-run skill file and is not concealed or
restored as part of item repair. The user subsequently authorized updating
that test for the global skill relocation; it now passes both assertions with
no skips. A subsequent whole-suite run encountered two stale catalog UI
assertions after concurrent edits removed the Game filter. Those UI edits
remain preserved; their assertions now verify underlying game isolation and
gameplay-stat filtering rather than removed presentation controls.
New watcher-network, mutation-cache invalidation and bounded-storage tests
pass. The final whole-suite run passed 846/846 tests with zero failures,
cancellations or skips. Production build (including typecheck) and
`check:release` passed. A local dirty-worktree 0.0.20 package snapshot was
exported with 134 files and SHA-256
`bd591fd479b4be1fda1b6727de3e9a91c94cc3103c76616119f7318e842d2f75`.
This is not a published release. Purchase/game acceptance remains pending.

## Purchase preflight

The Shoes I detail displayed 1,000 sats and enabled Buy. One Buy action
returned `Insufficient Player Wallet balance. 330 sats available; 1000 sats
required.` before creating any checkout record. No payment or delivery was
submitted. The error has OK and no Cancel, confirming ordinary errors retain
their non-cancelable default. Funding approval was requested before proceeding.

The preceding inventory error had an enabled Retry with white foreground
on `rgb(23, 90, 76)` and one Cancel button. Retry removed the error, displayed
one loading modal, and settled with nine cards and no modal.

## Approved test funding

The user approved 50,000 Mutinynet test sats after being informed of the
faucet minimum. The bundled funding helper submitted one request, operation
and transaction `816f3a25291efe6916c1ba0b68d24777c54d346823e71b36b3a7b4af9fd74cb1`.
The faucet acknowledged pending. Public operator reads returned this virtual
transaction and output 0: amount 50,000, preconfirmed, unspent, unswept and
not unrolled, with no assets. Its script is
`512012888fc29cdfe8a6697c0e11f3808e8e636974fbb403a940b9e5c8533d4b4349`.
No second payout was submitted. Edge wallet refresh/purchase remains pending;
page execution stalled while minimized. The user approved brief restores as
needed for testing; each recovery restores minimized state in a finally block.

## Completed purchase and fresh ownership

One Shoes I checkout `4f70edc1-3e13-40a6-bda2-691451f13e05` completed for
1,000 sats. Payment transaction:
`f42eb93802805fd12cf726e7b767126c162f2085c845f83c7a765f614c61c739`.
Delivery transaction:
`4a193701facbc83ea958cba02d7d12c5c2a625cbed11fc7115fbc19f535db717`.
Public output 0 contains quantity 1 of Shoes I asset
`f77b4dd78aad82de661e67523466de7830d6422d6f0d0141e2d8ed1e0fbf61cc0000`
on the Player script above; output 1 contains the eight remaining catalog items
on the Game script. No second payment or payout was submitted.

Live acceptance exposed a further cache bug: checkout completion requested a
normal preparation read, which reused the five-minute pre-trade inventory.
Preparation now accepts an optional force flag. Explicit Retry and confirmed
checkout completion propagate that flag through the coordinator for fresh,
network-scoped reads. Forced reads replace obsolete pending normal reads;
overlapping forced callers share one attempt. Regression tests cover Player
and Game cache replacement, both-role refresh and late old-result suppression.
After loading the repair, Marketplace rendered Shoes I under Player Wallet
and eight other cards under Game Wallet, with no errors. This is verified
ownership, not a synthesized checkout-success card.

## Game consumer acceptance

The user approved the local game 0.0.20 snapshot replacement. Archive and all
134 installed files, contract typecheck, 19 focused tests, all 1,130 game
tests and production build passed for the first repair snapshot. The final
force-refresh snapshot now also passes all those checks. BIS passes 857/857
tests, zero failures or skips; typecheck, production build and release check
pass. The final 134-file archive is exported and installed in the game with
SHA-256 `4de67c29df5ebdd25e8f47b30eac9c7ad5f0d602e3f4b94f57f18989672e6329`.
Its manifest records source commit `a527ea0d71b0afa42f9910f405a728583c4ba7b5`
and a dirty workspace; this is an authorized local repair, not a public release.
The restarted game route returns HTTP 200. Scoped consumer diff checks pass.
Muted Edge game startup and Settings → Account displayed BIS v0.0.20 at
`http://127.0.0.1:6001/blockchain-stealth-and-steel-game/?muteMusic=true&muteSFX=true`.
This separate origin has no signed-in account. The user was directed to sign
in on Mutinynet with the same Player Wallet for final equip/use acceptance;
no credentials were copied and no login/logout test was performed.
After the final import, the reloaded muted game again opened Account with
`BIS: v0.0.20` and `You are not logged in.` Browser reports zero console errors
and two WebGPU warnings. Edge was minimized in the verification finally block.
Task 4.4 remains incomplete until real equip/use is verified in the signed-in
game; successful chain-delta calculation is not counted as live gameplay.

## Final live gameplay acceptance (2026-10-11)

The authenticated in-app browser exposed the muted local game above. Its
Game Wallet view displayed Mutinynet and the expected Game address. After
reloading the busy wallet view without clearing storage, the real Items read
settled with Shoes I, price 1,000 sats, Speed +10%, Offense/Defense 0%.
The item card's data-asset-id was
`f77b4dd78aad82de661e67523466de7830d6422d6f0d0141e2d8ed1e0fbf61cc0000`,
exactly the asset delivered by the confirmed marketplace checkout above.
Clicking the card produced aria-pressed=true, a check mark, and the Shoes I
HUD slot; clearing it removed those active indicators. No new purchase,
mint, funding, login/logout test, credential copy or journal reset occurred.

Acceptance uncovered a game-consumer defect: equipment notifications updated
the menu/HUD snapshot but not already-spawned actors. Because initial wallet
hydration may exceed the 1.5-second guest-start budget, this could display
active Shoes while keeping baseline physics. The game now synchronizes live
player combat snapshots and movement multipliers on equipment changes.
The movement setter validates the normalized multiplier and resets invalid
values to baseline. This is game host wiring, not fabricated chain metadata.

Development-only canvas data-player-motion exposes the same getMovementSpeed
method used by real locomotion and the actor's actual world position. The
live unequipped run reported speed 210. After selecting Shoes I on the
existing player and starting gameplay, it reported 231.00000000000003,
an exact 10% increase within floating-point precision. Moving the joystick
changed the actor position from (224,224) to approximately
(222.471934,379.666376) while retaining that equipped speed. The game was
left paused in Settings with the Shoes I HUD slot active.

Raw pointer-hold distance comparisons were not used as timing benchmarks:
collision/grid alignment and browser input timing affected those samples.
The real actor regression instead measures identical simulation intervals,
proves 1.1x distance after activation and baseline after clearing, and covers
invalid multipliers. A second regression checks host notification wiring.
All 1,132 game tests pass with zero failures/skips; BIS contract typecheck,
production build and scoped diff checks pass. Build retains its existing
large-chunk advisory. Task 4.4 is now complete; earlier pending notes above
describe historical checkpoints, not the final outcome.
