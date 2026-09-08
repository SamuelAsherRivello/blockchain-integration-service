## Context

See proposal.md for motivation. This review inspected all runtime TSX components, the separate recovery popup, runtime CSS, demo App/Admin/Mint/preview/split/documentation components and styles, public exports, relevant specifications and isolated browser fixtures. This is source inspection, not a claim of browser or live Signet verification.

The current working tree includes the user's Set Recovery Phrase / Get Recovery Phrase names, default masking, and corrected shared heading flex layout. Preserve those edits. Core owns account and operation state; runtime UI consumes it privately. The demo mounts the public production UI. New UI helpers stay inside their owning package.

### UI inventory and disposition

Paths below are relative to packages/integration/src/ui unless prefixed with demo (packages/integration-demo/src).

| Area | Observed implementation | Proposed treatment |
| --- | --- | --- |
| client.tsx, GameOverlay.tsx | One account card and a conditional screen coordinator; recovery controls embedded in client; GameOverlay.tsx is a re-export | Extract AccountCard and RecoveryPhrasePanel; retain coordinator, public lifecycle and re-export |
| Set/Get recovery within client.tsx | Already share heading/grid markup; saved phrase acquisition differs; copy helper still has an unused non-inline branch | One private display component; explicit modes and session boundaries; remove unused branch after consumer check |
| RestoreAccount.tsx | Same warning and duplicated eye SVG; editable numbered inputs, paste distribution, validation and focus | Reuse warning/heading/visibility/paste controls; retain editable grid/controller |
| CopyFieldLabel.tsx | Reusable heading/copy icon presentation already used widely | Extend through a small FieldHeading and IconButton family, retaining CopyFieldLabel as a convenient composition |
| AccountAddresses.tsx, AccountBalances.tsx | Balance imports AddressRow and passes balances through an address prop | Extract neutral CopyableValueField with value prop; migrate both consumers |
| AccountAssets.tsx | Asset ID field, report copy, icon loading, list/detail selection, scroll restoration and burn | Reuse clipboard hook and field primitives; preserve report formatter, icon preparation, list controller and burn confirmation |
| AccountActivity.tsx | Detail textarea, whole-list copy fallback, selected row refs and explorer action | Reuse clipboard hook and CopyableTextArea; retain navigation, partial history behavior and row formatting |
| TransferRecoveryDetails.tsx | Standalone public-report React component with strong remount-based copy protection; no current production call site found | Reuse report field/hook while preserving standalone fixtures; do not wire it into a new screen or delete it |
| recovery-window.ts | Separate document with direct DOM creation and popup-local clipboard | Retain popup and formatter; do not introduce a React root/style dependency just to reuse a button |
| AccountSend.tsx, AccountTransfer.tsx | Already share AmountChooserRow; repeat definition-list review rows, sats formatting and expiry timer | Share ReviewDetails, UI sats formatter and useQuoteExpiry; retain operation controllers and focus effects |
| AmountChooserRow.tsx, AccountBalances.tsx | Working reuse across Send/Transfer and Balance/Transfer | Retain; update names/styles only as needed by extracted primitives |
| AccountInvoice.tsx | Unavailable invoice placeholder without a current production call site | Retain disabled state and module; do not expand its API to fit a generic form or enable invoices |
| PendingOperationDialog.tsx | Existing shared notice registry, host-local inert content and focus handling | Retain the provider/hook and modal boundary |
| ConfirmationDialog.tsx | Native modal with Cancel focus, Escape cancellation and preview positioning | Retain dedicated implementation; no duplication within runtime to justify a new modal framework |
| overlay.css | Shared styles intermixed with screen selectors; shared amount/review styles use transfer-specific names | Move ownership/names for extracted primitives together; preserve dimensions and screen-specific overrides |
| demo/AdminPanel.tsx | Story buttons rendered through both a map and special B/C branches | Local StoryAction component reused by mapped and special story buttons; retain labels, selection and disabled rules |
| demo/App.tsx, main.tsx | Public client/session lifetime and different Admin operation handlers | Retain orchestration and entrypoint; repeated async syntax alone does not justify a shared operation controller |
| demo/admin/MintAssetDialog.tsx, assets.css | Admin-owned native modal, mint validation, presets and retry lock | Keep independent; do not import private runtime controls or modal policy |
| demo/SplitWorkspace.tsx, preview/GamePreview.tsx | Already separated resizing and scale/host composition | Retain component boundaries and session-only preferences |
| demo/documentation.tsx, documentation.css, style.css | Dedicated Markdown/Mermaid page, dark demo theme and isolated preview styles | Retain renderer and theme ownership; no cross-package design-system extraction |

### Existing specification and fixture drift

account-creation/spec.md still describes immediately displayed recovery material and a Copy to Clipboard button above Continue. account-restoration/spec.md still specifies a Show checkbox, whereas production and restore-host's early assertions use an eye toggle. The user's recovery decisions in this session are authoritative for Set/Get. This proposal preserves today's restoration interaction; it does not claim those older documents match it.

recovery-host.tsx still navigates through Account Details/Account Activity and Recovery Phrase labels. details-layout.tsx expects a Loading... field where current values are blank under the pending overlay. restore-host.tsx includes older Retry/Account Details assertions later in its flow, despite newer pending-error behavior. During apply, correct touched fixtures only where the current implementation and confirmed decisions establish the expected behavior; record unrelated drift separately. Do not alter production merely to satisfy historical assertions. Main-spec reconciliation is separate from this refactor, so no delta specs are generated.

Active changes for Send, Transfer, invoice receiving, browser state and independent operations touch these screens or their policies. They remain independent; do not merge their proposed behavior into this refactor.

## Goals / Non-Goals

**Goals:** Give repeated UI structure and interaction mechanics a single owner, with small typed contracts and behavior-based regression checks. Make a shared control/layout fix apply to every actual consumer.

**Non-Goals:** A universal page schema, generic wallet workflow engine, new component library dependency, public UI-kit exports, theme redesign, modal behavior unification, changes to storage or SDK operations, or implementing other open changes. A review of every area does not imply rewriting every area.

## Decisions

### 1. Share recovery presentation within the private UI boundary

Extract RecoveryPhrasePanel for the read-only numbered words, heading, copy feedback and visibility state. Use an explicit setup/saved mode for presentation identity; the coordinator retains Set/Get title selection, creation Continue versus saved Back, saved loading/error registration, revealRecovery/hideRecovery calls and account lifecycle. A fresh panel session begins masked, and leaving/remounting or switching context/mode/account clears visibility and copy state. Avoid keys containing the phrase; use context/profile or non-secret session identity and component lifetime.

The panel receives private words and an explicit copy action/value accessor from its runtime caller. Nothing is added to BisState, public exports, Admin props, events or logs. Copy retains the existing single-space normalization. Rendering hidden words uses mask text, without putting the clear phrase in DOM attributes.

SeedWordsHeading composes the shared FieldHeading, copy or paste action, and VisibilityToggle. Its layout owns the single heading row for Set/Get; Restore reuses the controls while preserving its existing editable-grid placement. Extract the repeated test-wallet warning. Keep ReadOnlyRecoveryWords and restoration's input grid distinct: combining validation, paste distribution and editable masking into an all-purpose grid would enlarge the API and risk focus regressions.

Alternative considered: keep everything in client.tsx and add CSS selectors. This leaves duplicated restore controls and private recovery state entangled with account routing.

### 2. Reuse small interaction and field primitives

Introduce private IconButton with required accessible label, optional title, pressed state and disabled support; reuse named copy/paste/visibility SVGs and the existing refresh artwork. Keep callbacks and clipboard reads in their owning screen. FieldHeading accepts a semantic label or heading and action children; CopyFieldLabel remains its copy composition. Do not invent icon names through arbitrary strings or move unique asset artwork into an icon framework.

Extract a React useClipboardCopy helper for the existing write lifecycle. It accepts a current value supplier and non-secret scope identity, returns request status plus per-session successful-copy state, and ignores late results after unmount/scope change. Use a monotonically increasing request/scope generation so A → B → A cannot accept an obsolete completion. A synchronous in-flight guard prevents duplicate writes. The helper does not log values, read the clipboard, persist data or generate messages. It cannot cancel a browser clipboard write already accepted; it only suppresses obsolete UI feedback.

Recovery keeps its successful checkmark through subsequent copying/failure until its session changes, as copy-host already expects. Other callers retain their current messages and fallback layouts. Do not universally disable recovery copy during a repeated write if doing so changes its checked styling; the helper's guard handles duplicate clicks. Asset ID and report actions keep independent copy state.

CopyableValueField replaces AddressRow for addresses and formatted balances and is reused for the Asset ID while allowing that screen's existing manual fallback. CopyableTextArea combines an associated heading, explicit copy control and read-only report field for transaction detail and the standalone transfer report. Preserve textarea sizing and failure-only whole-list/asset-report fallbacks at the caller. Formatters stay in core and keep exact identifiers, quantities and report order.

Alternative considered: one generic copy form handling read, write, secret visibility and formatting. Those behaviors have different lifecycle and error semantics; small compositions make their differences explicit.

### 3. Extract stable review presentation without merging operations

ReviewDetails renders ordered label/value rows as a semantic dl, accepting already formatted React content. Both Send and Transfer use it, including Transfer's projected balances. A small UI sats formatter preserves en-US formatting; asset quantities continue using the existing exact asset formatter. useQuoteExpiry owns only timestamp-to-expired state and timer cleanup. Each screen still decides when a quote exists and how expiry disables confirmation.

Preserve each screen's initial amount, recipient/direction validation, Max semantics, pending reconciliation, quote invalidation, foreground/background notices, operation labels and explicit mutation callbacks. No generic retry hook is introduced. AmountChooserRow remains the shared amount input.

Alternative considered: a common payment wizard. Send and Transfer differ in source selection, estimates, pending reconciliation and feature gates; a wizard would transfer domain responsibilities into UI infrastructure.

### 4. Keep shell extraction presentational and package-local

AccountCard owns the existing section, network banner, title/description IDs and optional heading actions. Forward the heading ref used by current focus effects and preserve the DOM hierarchy required by asset/activity sizing. The screen coordinator retains navigation and pending notices; it passes content and actions instead of a large boolean-driven generic page configuration. The existing Account card already is a shared shell, so this extraction is for separation of responsibilities, not a new modal model.

PendingOperations must remain host-local so Admin stays interactive; ConfirmationDialog and MintAssetDialog retain native modal behavior and their distinct cancellation rules. List/detail selection, disappearing-row handling, scroll restoration and focus stay in Assets/Activity. Retain shared row CSS where appropriate without merging their controllers or adding transaction icons.

In the demo, StoryAction is local to Admin and consumes label/id, callback, optional selected state and disabled state. It preserves the existing B/C versus A/D arrow/selection presentation. No runtime import or generic async Admin controller is needed.

### 5. Keep CSS ownership aligned with extracted components

Give extracted heading, field, amount and review structures shared selectors rather than depending on a saved-account or transfer parent for essential layout. Retain the existing CSS export and theme scope. Screen-specific geometry remains explicit. Preserve existing DOM classes initially where fixtures or subgrid selectors depend on them, then migrate actual references together. Remove the non-inline recovery copy branch and obsolete selectors only after reference searches prove there are no remaining consumers, including standalone fixtures.

Alternative considered: split every selector into a new stylesheet or introduce global tokens across both packages. That adds churn without addressing the observed reuse failures.

## Risks / Trade-offs

- Secret/session state surviving extraction → Fresh private recovery sessions, no secret-derived keys, masked initial rendering, delayed-copy/unmount/account-switch checks using invalid placeholder words only.
- Clipboard behavior becoming accidentally uniform → Preserve each consumer's feedback and failure fallback; test repeated copy and A → B → A completions.
- Layout changes from wrappers or renamed selectors → Keep semantic structure and check element geometry at 280px and 360px host widths, short hosts, and demo scales 100%, 50% and 25%; explicitly compare Set/Get heading and icon vertical alignment.
- Focus and modal regressions → Retain modal ownership and screen effects; verify keyboard activation, pressed labels, Back focus and Admin usability while runtime is pending.
- Stale fixtures or concurrent feature changes obscuring results → Record baseline failures first, repair only demonstrably stale expectations in affected fixtures, and report remaining failures rather than treating them as passes.
- Excess abstraction → Extract the enumerated multi-consumer mechanics and the private recovery/card boundaries only; leave the deferred areas in the inventory unchanged.

## Migration Plan

1. Establish baseline fixture results and record uncommitted recovery behavior; create targeted recovery/layout coverage before moving its implementation.
2. Introduce field/icon/clipboard primitives and migrate consumers incrementally, keeping their presentation and messages stable.
3. Extract recovery panel and account shell with their lifecycle boundaries; verify Set/Get/Restore and independent hosts.
4. Migrate review rows/expiry timing and demo StoryAction, then remove proven obsolete local branches/styles.
5. Run relevant browser fixtures, focused existing Node tests, typecheck and build. Document results and any remaining known drift in a change-local verification record. Isolated fixtures must not use an existing wallet, submit live transactions or clear user browser state.

No data migration or deployment is required. If a slice regresses, back out that slice's edits while retaining the user's prior recovery changes; any Git rollback operation still requires authorization. Component names and the private UI directory layout may be adjusted during apply without changing the agreed boundaries.
