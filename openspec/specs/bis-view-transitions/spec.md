# bis-view-transitions Specification

## Purpose

Provide a consistent, lightweight visual transition for BIS navigable views so entering and leaving account flows is perceptible without changing navigation, wallet behavior, or view content.

## Requirements

### Requirement: Centrally configurable view transition

The BIS UI SHALL define the view transition duration, scale endpoints, opacity endpoints, and timing behavior in one shared configuration location used by all supported view transitions.

#### Scenario: Transition values are tuned centrally
- **WHEN** a maintainer changes the shared BIS view-transition configuration
- **THEN** all supported view transitions use the updated values
- **AND** individual views do not require separate animation-value edits

### Requirement: Navigable views animate on entry

Each supported navigable BIS view SHALL enter from 80% scale and 0% opacity to 100% scale and 100% opacity over 100 milliseconds.

#### Scenario: Open an account view
- **WHEN** the user opens Account Details, Send, Receive, Swap, Onboarding, Recovery, Assets, Contracts, Transactions, or another supported navigable view
- **THEN** the new view begins at 80% scale and 0% opacity
- **AND** it reaches 100% scale and 100% opacity within the shared transition duration

### Requirement: Closing views animate on exit

When a supported BIS view is closed or replaced by another view, it SHALL animate from 100% scale and 100% opacity to 80% scale and 0% opacity over the shared transition duration before it is removed from presentation.

#### Scenario: Press Back from a nested view
- **WHEN** the user presses Back from a supported nested view
- **THEN** the outgoing view visibly scales down and fades out
- **AND** the outgoing view is removed after its exit transition completes
- **AND** the destination view remains available with its existing navigation state

### Requirement: Supported view scope

The transition SHALL apply to the Account chooser, account menu, Account Details, Developer, Onboarding, Send, Receive, Swap, Restore Account, recovery screens, logout confirmation, Game Wallet Login, Assets, Asset Detail, Contracts, Contract Detail, Transactions, Transaction Detail, and the Pending Operation dialog.

#### Scenario: Navigate across supported screens
- **WHEN** the user moves between any two supported screens or opens or closes the Pending Operation dialog
- **THEN** the applicable entering and leaving surfaces use the shared view transition
- **AND** existing actions, labels, and navigation destinations remain unchanged

### Requirement: Non-view interactions remain stable

The transition SHALL NOT animate the Account entry button, ordinary loading or error content updates inside an existing view, dropdown menus, recovery visibility toggles, or toast notifications as full view transitions.

#### Scenario: Data refreshes within a view
- **WHEN** an existing view changes from loading to ready or displays an inline error
- **THEN** the view remains mounted and does not restart the full view transition
- **AND** its existing loading and error presentation remains unchanged

### Requirement: Reduced motion and interaction continuity

The BIS UI SHALL honor `prefers-reduced-motion` and SHALL preserve focus, keyboard interaction, pointer behavior, and Back semantics while transitions run. The active content of every transitioned view MUST be pointer-interactive as a whole, including controls that do not define their own pointer-event styling. Outgoing transition surfaces MUST remain inert and unable to intercept input.

#### Scenario: Reduced-motion preference is enabled
- **WHEN** the user has requested reduced motion
- **THEN** supported views appear and disappear without the scale-and-fade animation or with an effectively minimized transition
- **AND** the views remain usable and correctly focusable

#### Scenario: Navigation changes rapidly
- **WHEN** the user navigates again before an enter or exit transition finishes
- **THEN** the transition system cancels or supersedes stale animation state
- **AND** the newly selected view remains interactive without an obsolete outgoing view intercepting input

#### Scenario: Active view contains ordinary form controls
- **WHEN** a transitioned view displays text inputs, textareas, checkboxes, or other controls without an explicit pointer-event override
- **THEN** the user can focus and operate those controls with pointer and keyboard input
- **AND** the same interaction behavior applies across all views using the shared transition boundary

#### Scenario: Restore Account is opened
- **WHEN** the user opens Restore Account
- **THEN** all recovery-word fields, visibility controls, paste controls, Restore, and Back remain usable
- **AND** the active Restore Account surface does not require view-specific pointer-event rules
