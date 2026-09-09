## MODIFIED Requirements

### Requirement: Notification and acknowledgment boundary

Toasts SHALL carry brief noncritical notifications. Errors requiring acknowledgment SHALL retain their existing dialogs and OK actions. Confirmations and uncertain-outcome recovery information SHALL retain their current behavior. Pending operation presentation SHALL retain its current behavior except for the explicitly specified asset-burning toast flow. D1 SHALL NOT automatically translate existing wallet outcomes or inline clipboard indicators into notifications. Notification callers SHALL supply safe user-facing text without including secrets or raw wallet diagnostic payloads.

#### Scenario: Acknowledgment-required error
- **WHEN** an operation fails with an existing acknowledgment-required error
- **THEN** its error dialog stays present until acknowledgment and is not replaced or dismissed by a toast timeout


## ADDED Requirements

### Requirement: Burn status notifications
For each user-confirmed runtime burn attempt, BIS SHALL enqueue exactly one info toast reading `Asset burn (Pending)` as the attempt starts and exactly one success toast reading `Asset burn (Confirmed)` only when that attempt reports verified burn success. Pending means the attempt is in progress, not that submission or completion is proven. Confirmed means the existing verified burn result, not Bitcoin block confirmation. The shared queue, default duration, accessibility and runtime containment SHALL apply. The two messages SHALL retain pending-before-confirmed order even for immediate success. Errors, unknown outcomes, missing holdings alone and refresh completion alone SHALL NOT produce confirmed feedback. Re-renders or repeated callbacks SHALL NOT replay the attempt's notifications. Obsolete callbacks from another account or disposed context SHALL NOT enqueue notifications.

#### Scenario: Fast successful attempt
- **WHEN** a confirmed burn succeeds before its pending toast exits
- **THEN** the confirmed toast waits in the shared queue and both receive their normal lifetimes

#### Scenario: Refresh failure after verified success
- **WHEN** burn succeeds but holdings refresh exhausts its retry
- **THEN** the confirmed toast remains truthful and a separate acknowledgment-required refresh error appears without resubmitting the burn

#### Scenario: Stale callback
- **WHEN** the originating account changes or context is disposed before completion
- **THEN** the late result emits no new toast for the replacement account or context
