# Spec Delta

## MODIFIED Requirements

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
