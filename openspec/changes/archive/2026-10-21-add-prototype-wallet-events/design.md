# Design

## Context

See proposal.md for motivation and specs/prototype-wallet-events/spec.md for the behavior contract. The package currently has twenty demo routes in `src/client/navigation.ts`, shared React rendering in `App.tsx`, and route/source coverage tests. A new `demo-21/` entry can preserve all existing URLs. The shared root launcher discovers package entries through `BIS/scripts/dev-config.ts`; verify the popup entry is included in the package build as well as development routing.

The installed SDK is 0.4.79. Its `RestIndexerProvider` exposes `getVtxos`, `subscribeForScripts`, `getSubscription`, and `unsubscribeForScripts`. Subscription responses contain `newVtxos`, `spentVtxos`, and `sweptVtxos`. VTXOs can carry `assets`. `ContractManager.watchScript` also supports foreign scripts but intentionally reports only spendable received/spent outputs and reannounces them on restart. These facts come from the installed declarations and README, not a claim that a live test has passed. The public [IndexerService reference](https://pkg.go.dev/github.com/arkade-os/arkd/api-spec/protobuf/gen/ark/v1) confirms script subscriptions as the server mechanism; installed declarations remain authoritative for this pinned client.

Existing payment and asset sending demos target Wallet 1. Mint and Upgrade operate in Wallet 2. Read-only receive/history demos do not cause payment transactions. The existing production `player-wallet-subscription` capability concerns retained player accounts and remains separate. An older prototype-asset-upgrade navigation requirement differs from current ordering; this change inserts Events after the entire current Assets section without moving existing entries or resolving that unrelated discrepancy.

## Goals / Non-Goals

Goals: demonstrate an independent address observer, show only actual changes after startup, keep the popup presentation minimal, and keep observation lifetime independent of the main page's selected demo.

Non-goals: monitor signing or mnemonic access, discovering all HD addresses, monitoring Bitcoin boarding addresses from an Arkade address alone, global settlement feeds, a balance dashboard, persisted blockchain history, changes to transfer amounts, or a new backend. Preserve both sandbox network profiles. Verify Signet and Mutinynet receipts and readiness independently. The later accepted flip-side log records only observations made during the current popup session.

## Decisions

### Popup owns its listener

Add a dedicated popup entry such as `events-monitor/index.html`, with its own React root and small observer/presentation modules under the sandbox client. Execute synchronously calls `window.open` from the click gesture with requested width 500 and height 400. Pass only captured network and public address through encoded same-origin URL parameters. Validate them in the popup against the configured network/operator using the existing address validation helpers.

The popup imports no setup mnemonic helper and creates no signing identity. It observes the captured address independently even if its opener navigates or closes. This avoids an opener-owned React effect being disposed on sidebar navigation. The browser may clamp requested dimensions or open a tab; the app must not claim control over browser policy.

Use a stable named popup per opener and a retained window reference to focus an existing matching monitor. Relaunch for changed configuration replaces the observation and disposes its previous generation. Launch errors appear in the main Events output. Request native resizing. The card is a keyboard-accessible flip control, not a transaction control; the popup closes through browser controls.

### Direct SDK indexer subscription for the exact script

Decode the Arkade address using `ArkAddress.decode` and construct the P2TR script using the same `5120` plus taproot-key conversion already used by `addressScript` in App.tsx. Use a dedicated `RestIndexerProvider` for the selected operator. Consume `getSubscription` through an AbortController, and release the server subscription with `unsubscribeForScripts` on teardown where possible. Server-side leases/timeouts remain necessary when a browser process exits without completing asynchronous cleanup.

This avoids reconstructing a read-only wallet from an address that does not encode a complete wallet identity or arbitrary contract tree. It also exposes swept outputs beyond the ContractManager watch-only received/spent subset. `notifyIncomingFunds` remains useful for owned wallets but is not the chosen API for this arbitrary public-address monitor.

Normalize only outputs belonging to the captured script. A subscription response can describe other outputs in the same transaction, so filter each output independently rather than trusting the frame's script list. Preserve exact integer sats and asset quantities without unsafe number conversion. Aggregate matching outputs per transition and transaction when possible. Describe received sats, asset quantities/IDs, spent outputs, and swept outputs using only supplied evidence. Do not infer an outgoing payment or native asset mint from a generic output transition.

### Quiet initial synchronization

Take a complete paginated snapshot before opening the stream to anchor the historical baseline. Subscribe, consume and buffer incoming frames immediately, then take a second snapshot to reconcile subscription setup. Compare output transitions against the initial baseline, merge buffered evidence, and enter ready state only after preparation succeeds. Events received while the second snapshot is pending remain eligible, even if that snapshot already includes them. Never use that later snapshot to erase buffered arrivals as historical.

Track transition identities in popup memory using network, script, outpoint, and transition kind. A later spent transition has a different identity from receipt of the same outpoint. Replay suppression survives reconnects within that popup lifetime. Reopening starts a new quiet baseline. Receipt and subsequent spend during an unobserved initial connection gap cannot be guaranteed without historical evidence; report the observer's readiness truthfully and encourage running the other demos only once it is listening.

### Connection handling is distinct from activity

Use connecting, listening, reconnecting, and unavailable states. A locally started async iterator alone is not proof of stream readiness. Inspect the pinned SDK transport and confirm its ready/error behavior in browser verification. If the async iterator hides transport errors, provide an observer-local EventSource factory through the SDK's supported constructor option to relay open/error status while retaining SDK parsing and subscription methods. No SDK upgrade is required.

Retry interrupted streams with bounded exponential delay, capped at five seconds, under one generation and controller. Reconcile without replaying processed activity. Surface loss of readiness through the status line rather than a financial notification. After an activity's five-second display, restore the actual connection status. Closing cancels retries, stream, animations, and timers. Cleanup from an obsolete generation cannot update a new monitor.

### Minimal visual state and overlapping messages

Use the browser Web Animations API without a new animation dependency. The centered card scales through three one-second cycles, split into 0.5 seconds up and down. At three seconds it rests at scale 1. The description persists until five seconds from display, then returns to status text. Keep margin for 120% scale. Render descriptions as wrapped React text, never injected HTML.

The newest distinct event wins, cancels the old animation/reset timer, and starts its own five-second display. The front never queues old messages. Group related output deltas from the same frame. Reduced motion keeps message timing but omits scaling. Connection failure overrides idle listening immediately and remains the underlying state while activity is displayed.

### Animated status and flip-side session log

The white faces use the sidebar selection's 7px radius. Show Wallet 1, captured network, then status/activity. Advance one, two, and three dots at one-second intervals while the front is visible and idle; pause when hidden or flipped. Keep the accessible status label stable so dot ticks are not repeated announcements.

Clicking the card or pressing Enter/Space rotates an inner element around Y while the outer card retains independent pulse animation. The back fills the viewport height with a small margin and contains a scrollable chronological log. Record Connecting, Connected, subsequent distinct connection changes, and all observed activity, including events while flipped. Never log dot ticks, snapshots, or duplicate callbacks as new activity. Returning to the front shows only its current newest notification or status. Log state is in memory and resets on reload/relaunch. Reduced motion removes the flip transition and pulses.

### Shared sandbox usability and development sources

Keep the rail 232 CSS pixels wide across window sizes and let the right column flex. A shared demo-action component uses the current network context, a larger bold primary label, and a smaller regular-weight parenthesized network line with an accessible description.

Every action reads the latest submitted Setup values. Persistent wallet and contract repositories are scoped by selected network and wallet fingerprint, retaining the established mint/upgrade wallet namespace and SDK full-descriptor validation. No existing database is cleared. Separate browser profiles keep independent local state. The public monitor still captures only address/network and requires Execute again to retarget.

Source links use build-mode detection: development opens an allowlisted same-origin source viewer using raw-text imports that never execute the viewed module; production opens its GitHub file. The viewer is not a production build entry. Unknown file parameters cannot read arbitrary files.

All diagram examples retain their real Mermaid rendering. Use the self-contained ESM distribution, exclude Mermaid from dependency prebundling, and separate shared/isolated preview caches by port. This avoids stale optimized lazy chunks and nested CommonJS import failures without replacing diagrams with static sketches.

### Teaching page and verification

Keep Overview, Diagram, Docs, Input, Demo, and Output patterns. Input shows only captured public address and network. The source sample must match the actual public observer/launch behavior and follow exactly Arrange, Act, Assert, with imports before storage reads. Execute success means the monitor started, never that payment occurred. Document a separate window rather than an always-on-top guarantee.

Use deterministic tests for snapshot races, replay suppression, script filtering, exact amounts, interruption and cleanup, plus browser checks for popup ownership, sidebar navigation, pulse timing, and reduced motion. Keep test injections out of the production popup route. Perform funded Signet payment and asset-send acceptance separately, correlating public transaction/outpoint evidence. External-wallet sending is an additional manual path when available. The monitor itself never initiates a funded operation.

## Risks / Trade-offs

- Browser popup restrictions or background throttling can affect size and animation scheduling. Request the size, surface blocked launch, and verify foreground animation timing.
- The stream can replay events or omit categories unsupported by the operator. Deduplicate, label only supplied evidence, and report unavailable transport rather than fabricated notifications.
- Fast overlapping transactions replace each other's messages under the proposed newest-event behavior. The popup is an activity indicator rather than an audit trail.
- Stream and snapshot initialization can race. Use the initial anchor, buffer immediately, and verify the race deterministically before funded checks.
- A raw subscription requires explicit retry/cleanup ownership. Keep it in a small independently tested observer rather than the shared App.tsx component.

## Migration Plan

Add the demo, popup, development source viewer, documentation, and tests without renumbering routes or deleting wallet state. Existing mint/upgrade namespaces are preserved; other demos select those network/identity-scoped repositories. Shared Vite changes are limited to diagram loading and per-port caches. No financial data migration or contract recovery is involved. Keep temporary evidence under repository-root output categories and never include recovery phrases.

## Open Questions

No product decision remains open. The user confirmed payment and asset behavior and approved reconciliation of the five-second timing, flip log, animated status, network labels, fixed rail, isolated wallet state, local sources, and diagram repair. Live receipts/reconnection on both networks and deterministic spent/swept coverage are recorded separately in verification.md.
