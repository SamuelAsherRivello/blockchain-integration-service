## Context

Player Wallet restoration owns a complete local phrase-entry state machine in `RestoreAccount.tsx`, while `GameWalletLogin.tsx` maintains a separate phrase string and textarea. Both flows use the same recovery validation utilities and must keep phrases private. See [proposal.md](proposal.md) for motivation and the game-wallet-restoration delta spec for the behavior contract.

## Goals / Non-Goals

**Goals:**

- Centralize the private twelve-word entry interactions, validation, clipboard handling, masking, and focus behavior in one typed React component.
- Let each caller own submission lifecycle, error copy, action label, and Back destination.
- Decrease only the row height and inter-row gap needed to fit the unchanged recovery controls without scrolling.

**Non-Goals:**

- Change game-wallet encryption, import, persistence, Signet calls, or player/game wallet isolation.
- Change the separately administered F1 game-wallet import field.
- Change recovery-word font sizing or semantics, or expose phrase content beyond the local component callback.

## Decisions

### Extract a controlled recovery-entry component

Create a component that owns its transient word array, visibility toggle, paste feedback, and local validation. It receives a submit callback and caller-provided action/back controls. Player restoration will delegate to its existing context controls; Game Wallet restoration will delegate to `importWallet` only after local validity permits it.

This removes duplicate secret-entry UI while avoiding a shared wallet-state abstraction. Passing an unstructured phrase upward only at explicit submit preserves the existing core boundaries. Reusing `RestoreAccount` directly was rejected because it couples Game Wallet entry to Player Wallet context phases and navigation.

### Preserve visual primitives and compact CSS

The component continues using `SeedWordsHeading`, `PasteButton`, existing word semantics, and `.bis-restore-grid` styles. CSS will decrease field height, surrounding item padding, and grid gap while retaining the current input font declaration. No fixed scroll region or scrollbar will be introduced; the existing card remains non-scrolling at the supported preview geometry.

### Verify both callers at the UI boundary

Extend the isolated UI host to open each restoration flow and assert the shared grid and compact geometry. Retain the Player Restore host checks for paste, masking, checksum, submission, and cleanup, then build and visually inspect the served demo in a real browser.

## Risks / Trade-offs

- [A new shared component changes a security-sensitive entry surface] → Keep phrases in React-local state only, preserve the existing validation and masked input behavior, and verify current private UI tests.
- [Compaction could clip touch or focus affordances] → Reduce only excess vertical padding/height, retain two-column input widths and focus outlines, and inspect the 9:16 view.
- [Player and Game Wallet async states differ] → Keep busy state and submit operation management in each caller rather than hiding them in the reusable component.
