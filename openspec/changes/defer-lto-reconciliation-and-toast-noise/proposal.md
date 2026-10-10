# Proposal

## Why

The current LTO service reconciles durable contract records as soon as the Admin application loads and emits `Offer funding pending` again after every refresh. This makes recovery machinery look like a new user action, creates unnecessary notifications, and obscures the intended ownership boundary between Admin contract inspection and game-triggered treasure offers.

The change is needed now because the existing behavior is confusing in the Admin demo and does not match the desired game flow: an offer should begin when a game level begins, while contract recovery should remain durable but quiet until a meaningful inspection or operation occurs.

## What Changes

- Stop ordinary Admin/application initialization from performing provider-backed LTO reconciliation or emitting pending-operation toasts.
- Keep durable contract records and encrypted recovery material restorable on load, but separate silent local restoration from targeted provider reconciliation.
- Make the Admin Contracts page the explicit inspection boundary: opening it reads current contracts, and contract details/actions can explicitly check status or reconcile a selected operation.
- Keep Admin's developer `Start LTO` as an explicit funding trigger; show funding progress in the contract surface and Console rather than as a startup toast.
- Make game level start the explicit treasure-offer trigger. Gameplay begins immediately, the offer deadline starts with the level, and funding remains background state until the game needs to present the chest.
- Make chest interaction query only the current level/session offer and present preparation, active, expired, skipped, or unavailable states in game-owned UI.
- Restrict LTO toasts to meaningful user actions and state transitions, such as accepted Claim/Reject, verified claim/refund, or actionable failure. Repeated startup observation of an unchanged pending record SHALL be silent.
- Preserve durable exclusivity, reservation, recovery, and no-duplicate-spend guarantees while changing when reconciliation is requested and when feedback is presented.

## Capabilities

### New Capabilities

<!-- None. The change refines existing contract and game-offer capabilities. -->

### Modified Capabilities

- `account-contracts`: Make the Contracts page and explicit contract actions the user-facing reconciliation boundary without changing its read-only inspection or eligible-action guarantees.
- `limited-time-offers`: Separate silent durable restoration from targeted reconciliation, suppress startup pending toasts, and retain recovery/exclusivity guarantees for explicit Admin and game lifecycle triggers.
- `treasure-lto-demo`: Start demo/game offers from explicit actions and game level start respectively; keep funding nonblocking and move preparation/status presentation to the Contracts surface or game-owned chest interaction.

## Impact

Affected implementation areas include the BIS LTO service and Arkade reconciliation adapter, Admin contract/demo controls, the game-facing LTO session lifecycle, and related browser/unit tests. The public provider-neutral contract query and action APIs should remain usable; the change may add explicit reconciliation or lifecycle methods if the existing surface cannot express the new trigger boundaries.

The separate game repository will need to consume the revised lifecycle contract after the BIS package changes. Existing unresolved records remain durable and recoverable; this proposal does not erase, hide, or automatically replace them. Open decisions for design are the exact explicit status-check API shape, whether a visible Contracts-page read may reconcile or must remain read-only until a button is clicked, and how much silent active-operation polling remains enabled after an explicit start.
