# C094-T010 wallet hardening review, 2026-10-26

T010 remains unchecked. Current CLI progress is 23/36. This task reviews the
approved local Player/Game Wallet model, not the separate hosted treasury work.
The coordinator subsequently authorized the minimal game CSP implementation,
explicit per-offer funding consent and browser verification. No dependency import, wallet/provider operation or
upstream contact was assigned or performed.

## Package and primary-source boundary

Current BIS is 0.0.26; the game and its installed/vendored BIS remain 0.0.23.
Both installed SDK packages report 0.4.79. The game's archive remains
`bis-integration-0.0.23.tgz` with SHA-256
`1ad3cdb15b4d67d23a42addedb921999aff30bde694f0bc6a5bb546995aceace`.
Source snapshots hash manifests, lockfiles, inventory, installed SDK README,
relevant UI/DTO/storage files, CSP sources and the actual built game HTML.

The SDK's package README is primary documentation shipped with the exact pinned
version. Its renewal and exit sections are the version-specific evidence here.
The [public TypeDoc reference](https://arkade-os.github.io/ts-sdk/) currently
identifies itself as 0.5.0-rc.25, so its latest APIs do not qualify 0.4.79.
The [official contract overview](https://docs.arkadeos.com/contracts) describes
collaborative and CSV exit leaves and the two-step operator spend. The
[official index](https://docs.arkadeos.com/llms.txt) links renewal, security and
storage guides, but those linked pages were not accessible through the browsing
tool in this pass. That retrieval limit is not evidence that the guides do not
exist. No recommendation to change SDK versions follows from this review.

Fresh `npm audit --omit=dev --json` completes successfully for both repositories
with zero reported production vulnerabilities. This verifies the advisory check
for their current lockfiles; it is not a general key-isolation or correctness
guarantee. Neither audit modifies a dependency or lockfile.

## Game policy implementation and verification

The original production game GET returned HTTP 200 with no CSP header,
report-only header or CSP meta tag. Local Vite configuration also had no CSP
plugin. Static Pages can enforce script policy through a CSP meta tag, so its
hosting model is not a blocker to adding this protection.

The new game-only build plugin inserts the policy before resource loading. It
allows same-origin scripts and hashes the exact authored inline script/style
bytes. It forbids inline script/event handlers, eval, unapproved inline styles,
foreign scripts, frames, workers and objects. It allows only same-origin fonts,
media and images, with data images for QR content. Connection origins come from
the installed 0.0.23 test-network provider/faucet inventory, without wildcards,
mainnet, arbitrary HTTPS, localhost signing endpoints or future hosted signer
configuration. Navigation links are not script/frame permissions. A later BIS
import must review any new required origins.

No `unsafe-inline`, `unsafe-eval` or `wasm-unsafe-eval` was needed. Existing
game/React styling through CSSOM still works. The plugin applies to production
builds, so it does not change shared development/HMR behavior or weaken BIS CSP.
Pages meta policies cannot enforce `frame-ancestors`; no framing/isolation claim
is made. The approved local model still places keys and signing access in the
browser's trust boundary.

Three new policy unit tests pass. The normal game production build passes and
emits version v0.0.23. Publishing-contract tests pass 10/10 and public BIS
contract typechecking passes. Four unchanged BIS policy/static-HTML checks also
pass; its separate browser case was deliberately not invoked in this audit.
The existing BIS implementation and policy were not changed.

Managed playwright-cli verification used a fresh guest context, both audio mute
parameters and a guard blocking nonlocal requests. Initial sandbox/preview and
Chrome crashpad failures were resolved by the host execution context. The first
headless browser lacked a WebGPU adapter. Repository-managed full Chromium with
the documented SwiftShader WebGPU adapter then ran the real built game. These
are test setup changes, not production browser flags or relaxed CSP directives.

The negative test intentionally creates six violations: inline script,
inline event handler, foreign script, unapproved style element, foreign fetch
and eval. The ordinary same-origin control script runs; each unapproved action
is blocked, and CSSOM updates remain allowed. These six events are recorded
separately from normal application behavior.

A fresh navigation without canary injection has zero violations at every
asserted boundary: initial load, guest Start completion, settings and Account.
The actual 0.0.23 modal exposes `Create Account` and `Restore Account`. An initial
test wrongly waited for `Create Wallet`; its timeout is preserved. The corrected
selector passes without submitting either account action. A guest screenshot
and exact scripts/results are retained. No account/wallet was created or
restored, and no provider request was allowed through the guard.

The named test browser and ownership-verified temporary preview on port 6176
were closed. Shared ports, servers and existing wallet storage were untouched.

## Consent and private-data review

The current BIS Admin renders a notice that Start LTO locks 1,000 sats from the
selected Game Wallet, both wallets are locally controlled and this is not a
protected publisher treasury. The provider-free disclosure test passes for
Signet and Mutinynet. This is evidence for Admin consent presentation only.

The installed 0.0.23 wallet setup alone did not establish informed consent to
reward funding. The subsequently authorized game-host change now creates an
`awaiting-consent` state at explicit Start instead of calling `offers.start`.
The new window identifies the selected Game/Player profiles, network, exact
1,000-sat lock and reward, supported zero-fee policy, automatic local signing
without another wallet popup, original deadline and refund/browser-validation
limits. Skip is initially focused. Long terms scroll while both actions remain
within desktop/mobile viewports. The title and text sizing were verified with
the actual game CSS; `display:block` is required because the shared treasure
content class otherwise uses `display:contents` and cannot bound the terms.

Only explicit acceptance of that original offer can call the public BIS Start
API. The game rechecks wallet/network binding and deadline immediately before
the call. Acceptance never extends the original rounded-down deadline, repeated
approval cannot submit twice and stale controls cannot approve a replacement
offer. Decline, close, Escape and ending an unapproved session issue no financial
or `endSession` call. Restoration remains unverified and can inspect/recover an
existing contract, but cached approval never authorizes new funding.

The focused consent/runtime/recovery/UI suite passes 32/32. The final full game
suite passes 1,174/1,174 with zero skips or TODOs; final build, publishing tests
and public contract typechecking pass. Browser consent checks use synthetic
public profile IDs with financial methods that throw, not created wallets or
fabricated contract outcomes. Both 1280- and 390-pixel viewports show the required
terms, reachable actions, zero calls on Skip/close/Escape and zero CSP violations.
The fixture initially omitted the production UI scope/viewport-ready class;
those harness failures and the genuine action-overflow failure are preserved.
No live acceptance or browser funding is inferred from these tests.

Both current and installed-old `presentContract` functions explicitly build
public DTOs rather than spreading private recovery records. The inspected
LTO service/adapter/public integration entry points have no console calls.
Seventeen focused storage, validation, Admin-disclosure and diagnostics tests
pass, including non-plaintext encrypted recovery and network binding. These
checks do not prove all SDK error paths or a deployed bundle cannot disclose
private data. The pinned SDK still has raw exception logging in other paths;
no actual secret leak is asserted from that source pattern alone. Preserve the
bounded public projections and evaluate the exact imported runtime/logging
boundary during release acceptance. Encrypted recovery on the same origin does
not isolate signing from a compromised same-origin script.

## Expiry and exit disclosure

The recovery guide now distinguishes the offer deadline from batch expiry,
documents the absence of verified automatic custom-contract renewal/closed-client
work, and explains fee, confirmation, CSV and BTC-only exit constraints. The
pinned SDK README says onchain funds can be needed for exit fees, and that
pre-signed packages may embed condition witnesses and omit paths requiring
other parties. No primary evidence was obtained for guaranteed economical exit
of these 1,000-sat treasure outputs or automatic renewal of their custom scripts.
Those guarantees remain unclaimed. No exit or renewal operation was performed.

## Remaining T010 gates

1. Publish only through the separate qualified release workflow, then verify
   the exact deployed game build contains/enforces the reviewed policy. The
   current public site still lacks it; local build/browser success is not
   deployed-host verification.
2. Recheck CSP origins, dependency inventory and public/log privacy against the
   exact subsequently imported BIS artifact. Existing 0.0.23 evidence cannot
   qualify a different package or the new server-wallet model.

No T010 checkbox is marked complete, and no T035, B1/B2 or release gate changes.
The B2 source pin is preserved. Machine-readable evidence and hashes are in
`output/reports/treasure-contract/t010-hardening/`; game build/browser evidence
is in the adjacent game's `output/reports/treasure-t010-csp/`.

The final frozen eight-file game implementation pin is
`78a6d0f6c2e759f373024381a16ceddd98f3f8d194d422cafb0331edb71a6a72`.
It supersedes the first `9b92be391d9f7bd71c9caa638a1710b01fe0e9c0fb3b9cc58a1e0b5412052e21`
pin only for the necessary consent-window layout correction. The final full-suite
snapshot and source hashes agree. Final source, public primary-package inputs,
served/built HTML match, artifact inventory and scoped cleanup are recorded in
`verification.json` and `implementation-snapshot-final.json`. Both temporary
preview/browser sessions are terminal. No T010, T035 or live qualification pass
is inferred from local source completion.
