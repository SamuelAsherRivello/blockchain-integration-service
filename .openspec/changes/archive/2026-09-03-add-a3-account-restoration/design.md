## Context

See proposal.md for motivation and the delta specs for behavior. A2 already creates an English phrase using generateMnemonic(wordlist), derives identity through MnemonicIdentity.fromMnemonic with isMainnet:false, hashes the compressed public key for profileId, and stores AccountSecret in encrypted IndexedDB. A6 supplies logout and cross-context reconciliation. A3 adds recovery entry across those existing layers.

Inspection on 2026-09-03 found @arkade-os/sdk 0.4.67 and @scure/bip39 2.0.1 installed. The installed BIP39 implementation defaults generation to 128-bit entropy and exposes validateMnemonic; therefore the current A2 format is 12 words. SDK declarations expose fromMnemonic, and the existing adapter already reconstructs that identity during hydration. These are local API observations, not proof that live Signet restoration currently succeeds. Verify operator network and a real restoration round trip before marking the implementation complete.

## Goals / Non-Goals

**Goals:** Preserve derivation and persistence compatibility, isolate secret input from host-facing state, reuse account lifecycle protection, and make restoration independently demonstrable.

**Non-Goals:** Retaining a long-lived operational wallet, querying balances/assets, arbitrary seed compatibility, passphrases or alternative derivation paths, new dependencies, storage migration, game changes, or deployment in this planning step.

## Decisions

### 1. Keep secret entry private to the production flow

The production UI owns twelve numbered word inputs and its Show checkbox. A private UI/Core control accepts recovery submission; host-facing controls may open restoration but public state/events never contain words. Core holds only the submitted transient account material needed for network/save retry. Reuse the existing private controls boundary rather than requiring Admin or the game to pass a mnemonic.

Use the single Show checkbox exactly as confirmed. Unchecked populated fields render one `*` per character, not the actual word. The visual mask is not the input value: never submit masking characters as a word. The underlying editing mechanism must support insertion, deletion, replacement, selection, keyboard, and touch while hidden; verify these explicitly. Labels and validity descriptions identify word position without exposing its text to host state or captures. Do not promise that visual masking protects against same-origin scripts.

A plain phrase textarea was superseded by the user's numbered grid. Per-word reveal controls and always-visible text were rejected in favor of one checkbox.

### 2. Validate locally using the installed dependency

Normalize English case and surrounding whitespace; split whole-phrase paste on whitespace. Do not autocorrect, reorder, suggest replacements, or truncate extra words. Use a Set of the installed English word list for field indicators and validateMnemonic for the complete checksum, repeating validation at the private Core/adapter boundary to prevent UI bypass. Empty fields stay neutral; green/red indicators also have non-color accessible status. Show a checksum error only once every field is individually valid.

The 12-word restriction follows the existing creation format rather than claiming support for all BIP39 lengths. A nonempty-only check was considered but is weaker and unnecessary because validation is already available. Phrase validity does not prove that BIS originally created it, or prove which network it was used on. Describe support as experience-created test accounts, retain the real-funds warning, and do not invent an origin registry or claim origin detection.

### 3. Treat paste as an atomic replacement

An explicit Paste from Clipboard click unchecks Show before reading. A 12-word result replaces all fields together and triggers validation even if words/checksum are invalid. Wrong counts and clipboard failure keep all current words unchanged and hidden, with safe error copy. No automatic clipboard reads, no clipboard logging, and no clipboard clearing. Invalidate pending clipboard reads when leaving the screen; an older paste must not overwrite a newer edit or paste. The player can always type manually. Individual fields also distribute multiple whitespace-separated words into consecutive fields from the selected position; typing a separator advances focus. Reject overflow atomically without altering existing words.

### 4. Reuse creation derivation with a supplied phrase

Factor the adapter's common checked Signet connection and temporary Wallet.create lifecycle so creation supplies a generated phrase and restoration supplies a validated phrase. Preserve isMainnet:false, identity derivation, and profileId hashing exactly. Keep the existing operator URL and check the returned network in both the initial info request and the SDK provider info path. Successful Wallet.create plus address acquisition and required network checks establishes this slice's connection gate. Release temporary wallets on success, error, timeout, and late completion.

Do not invoke wallet balance or asset queries. Reconstructing a deterministic identity alone is insufficient for activation because the user explicitly required a successful Signet connection. A live operation failure blocks the account-access success path and is not replaced with a simulated result.

### 5. Extend the existing account state machine

```text
Account chooser --> Recovery entry --> Connecting --> Saving --> Account active
                         ^                 |            |
                         |                 v            v
                         +------------ Restore error / save error
                                          |
                                       Retry / Back
```

Use explicit restore-entry, restoring, and restore-error states (exact internal names are implementation choices); reuse saving/active where appropriate. Restore is disabled until locally valid, and duplicate submission is ignored. Success saves through the same generation-checked storage path, then emits accountConnected once and returns to the open Account dialogue. There is no additional Continue or recovery-display screen. The logged-in message shows the shortened public Account ID on the line following "You are now logged in as".

Network failure unchecks Show, keeps words in memory for Retry, and does not persist. Back clears transient input and returns to the chooser; Back during connection aborts/invalidates it. As a planning default, disable Back during the short durable-save phase and reconcile its result before navigation. This prevents claiming cancellation after a commit. Save failure keeps the account inactive until durable state is confirmed; safe Retry reuses the reconstructed account when appropriate and reconciles uncertain commits before writing again. No new identity is generated on restore retry.

### 6. Preserve concurrent-account protection

Use version/AbortController invalidation and storage generation checks already present in Core. Restoration starts only after hydration confirms no account. Existing storage refuses a save if another identity exists or generation changed; do not weaken that guard. On conflict, release pending restoration material and reconcile current storage instead of overwriting. Refresh while entering or connecting discards transient input. Disposal and successful activation clear all recovery fields; reset/account-change notifications invalidate stale work. Do not modify A6 or reset storage-clearing behavior for this feature.

### 7. Demonstrate through production APIs

Admin's Restore Account selection opens the same Account dialogue as other account stories and never supplies a phrase. A real active account routes to the minimal logged-in dialogue. Story documentation updates must retain A3 step IDs while rewriting A3.07 as account-access preparation/persistence with wallet/asset loading deferred and A3.09 as the minimal Account dialogue; A4 keeps the full menu. Update stale current-status references in account/demo documentation without rewriting historical A2/A6 scope.

## Risks / Trade-offs

- Masked rendering can interfere with editing and caret behavior -> keep actual word state separate from the visual mask and explicitly test hidden typing, deletion, replacement, and focus on keyboard/touch.
- A valid mnemonic can still be a different identity because of a typo that passes checksum -> validate but do not claim that a valid phrase proves the intended account; verify a known same-profile round trip.
- Operator availability can block recovery -> bounded timeouts, Retry/Back, and no premature activation; live evidence remains pending until exercised.
- Late network, clipboard, or storage completion can outlive the view -> operation invalidation and reconciliation; no late activation after cancellation/disposal.
- Local encryption does not isolate secrets from scripts executing on the same origin -> retain the existing test-only security posture and keep recovery material out of telemetry and test output.

## Migration Plan

No schema migration or new dependencies. Implement after a separate apply request, preserve existing public APIs, and add non-secret controls as needed. Validate account tests, builds, production/demo parity, and the real Signet round trip before release. If live checks fail, report pending evidence rather than marking A3 complete. Any later rollback should be an additive change disabling new entry while preserving existing saved accounts and history; do not discard user data.

## Open Questions

No unresolved scope decisions. Exact responsive column count, safe error wording, and internal phase names can be settled during implementation while preserving the specified behavior. Live Signet availability and SDK lifecycle behavior are verification gates with explicit tasks, not assumed successful results.

## Delivered verification

All 14 tasks are complete. Live Signet same-identity restoration, persistent reopening including browser restart, isolated failure checks, and subsequent UI refinements are recorded in .openspec/changes/archive/2026-09-03-add-a3-account-restoration/A3_VERIFICATION.md. Earlier references to verification gates describe the original plan; the completed evidence resolves those gates for A3.
