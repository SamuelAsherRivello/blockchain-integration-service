# Tasks

Implementation and verification are complete. Checked tasks record completed work; see verification.md for the real-network evidence and test limitations.

## 1. Public-address observer

- [x] 1.1 Add an isolated sandbox observer using the pinned SDK indexer subscription API, validated captured address/network, exact-script filtering, and exact integer sats/assets; verify deterministic tests for matching and unrelated outputs and received/spent/swept descriptions, with no mnemonic reads or signing wallet construction.
- [x] 1.2 Implement initial snapshot anchoring, immediate stream buffering, follow-up reconciliation, and transition deduplication; verify existing holdings stay quiet, events during preparation appear once, reconnect replay stays quiet, and receipt/spend transitions remain distinct.
- [x] 1.3 Connect SDK transport open/error status to readiness, retry with capped backoff, and implement generation-safe abort/unsubscribe/disposal; verify stalled/failed setup never claims listening, only one stream survives reconnect, and disposal cancels pending work. Document operator coverage and stream limits alongside the observer.

## 2. Popup presentation and launch

- [x] 2.1 Add the independent React popup and 7px-rounded white card on black with Wallet 1, captured network, animated idle status dots, and a Y-axis flip to a full-height chronological session log; verify click/keyboard interaction, logging during observation, independent rendering, and no mnemonic access.
- [x] 2.2 Implement descriptions and tweens: three 0.5-second up/down cycles, scale 1 to 1.2 to 1, stationary from second three through second five, then current-status reset; verify five-second newest-event replacement, obsolete timer cancellation, dot cadence, and reduced-motion alternatives with controlled time and browser inspection.
- [x] 2.3 Add synchronous user-gesture launch requesting 500 by 400, one-popup reuse/focus, changed-configuration replacement, blocked-popup feedback, and closure cleanup; verify browser scenarios for repeat Execute, sidebar navigation, opener closure, popup close/reopen, and network/address changes.

## 3. Sandbox teaching integration

- [x] 3.1 Add demo-21 and Events between Assets and Smart Contracts, popup build wiring, the fixed-width rail and network-aware demo-action labels; verify routes, ordering, build inclusion, responsive widths, and selected-network updates across all demos.
- [x] 3.2 Add Events overview, sequence diagram, public input, source and output, plus links/instructions for Send Payment, Send Asset, and external-wallet sending; verify the source's Arrange/Act/Assert structure, real observer launch behavior, honest launch status, and explanation that Mint Asset alone affects Wallet 2.
- [x] 3.3 Document popup use and scope; add readable local Vite source windows with GitHub production links and network/identity-scoped SDK storage that immediately uses submitted Setup edits; verify allowlisting, source destinations, identity switching, browser-profile separation, preserved state, README links, route counts, and commands.

## 4. Integration acceptance

- [x] 4.1 Run all sandbox deterministic/browser checks, root typecheck, and package build; repair shared Mermaid loading and preview-cache isolation, verify SVG rendering on all 21 demos, and record attributable limitations separately from regressions.
- [x] 4.2 Verify the real Signet flow using approved test wallets: open the monitor and wait for readiness, run existing Send Payment, then Mint Asset and Send Asset, and observe independent network notifications, pulses, and resets; retain only public evidence under `output/reports/prototype-wallet-events/`, and leave this task incomplete if funding or live delivery cannot be verified.
- [x] 4.3 Verify payment/asset delivery and interrupted/recovered connectivity independently on Signet and Mutinynet, with external-wallet sending optional; document public receipts, deterministic spent/swept coverage, and unavailable acceptance without fabricating events or treating UI tests as network proof.
