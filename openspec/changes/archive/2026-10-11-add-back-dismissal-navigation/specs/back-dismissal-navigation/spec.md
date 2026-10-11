# Spec Delta

## Purpose

Provide a predictable, opt-in way to leave BIS views that already have a Back destination by treating Escape and an outside-card backdrop click as equivalent Back actions.

## ADDED Requirements

### Requirement: View-level back dismissal opt-in

Every BIS view participating in the shared view presentation SHALL declare a boolean back-dismissal capability. The capability SHALL be enabled only when that view has a valid existing Back or cancel destination, and SHALL be disabled for views without such a destination.

#### Scenario: View with Back enables the capability
- **WHEN** a view has an existing usable Back action
- **THEN** its declared back-dismissal capability is true
- **AND** Escape and an outside-card click are eligible to invoke that same Back behavior

#### Scenario: View without Back disables the capability
- **WHEN** a loading, terminal error, entry, or other view has no Back or cancel destination
- **THEN** its declared back-dismissal capability is false
- **AND** Escape and outside-card clicks do not navigate away from that view

### Requirement: Escape delegates to Back

When the active view has back dismissal enabled, pressing Escape SHALL invoke the active view’s existing Back action exactly once and SHALL prevent the event from being handled as an unrelated browser or ancestor action.

#### Scenario: Escape leaves an eligible view
- **WHEN** the user presses Escape while an eligible view is active
- **THEN** the view follows the same destination and state transition as clicking Back
- **AND** focus restoration and view-transition behavior remain the same as the Back path

#### Scenario: Escape is blocked while Back is unavailable
- **WHEN** the active view is disabled, busy, closing, or otherwise unable to perform its Back action
- **THEN** Escape does not trigger navigation or duplicate the in-flight action

### Requirement: Backdrop click delegates to Back

When the active view has back dismissal enabled, a pointer click on the backdrop area outside the active card SHALL invoke the active view’s existing Back action exactly once. Pointer interaction inside the active card SHALL not invoke back dismissal.

#### Scenario: Click outside the card
- **WHEN** the user clicks the backdrop outside an eligible view’s card
- **THEN** the view follows the same destination and state transition as clicking Back

#### Scenario: Click inside the card
- **WHEN** the user clicks, drags, or operates a control inside the active card
- **THEN** the active view remains open
- **AND** the control keeps its existing pointer and keyboard behavior

### Requirement: Nested navigation keeps its local Back meaning

Back dismissal SHALL use the Back handler of the currently visible view state, including list/detail and nested account flows, rather than closing the entire account surface prematurely.

#### Scenario: Detail view is active
- **WHEN** a collection detail view has an enabled Back action and the user presses Escape or clicks outside the card
- **THEN** the detail view returns to its collection list
- **AND** it does not close the parent account surface unless that is the existing Back destination

#### Scenario: Pending operation covers a view
- **WHEN** the shared Pending Operation Dialog is covering a view
- **THEN** the covered view’s back-dismissal interaction cannot be reached
- **AND** the pending dialog retains its existing non-dismissible behavior unless it already exposes an explicit cancel action
