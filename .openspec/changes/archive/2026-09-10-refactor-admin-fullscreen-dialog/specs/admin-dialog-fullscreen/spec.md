## Purpose

Provide a reusable, accessible large-dialog presentation for Admin workflows that need a consistent viewport-relative shell.

## ADDED Requirements

### Requirement: Admin fullscreen dialog presentation
An Admin fullscreen dialog SHALL be modal and SHALL occupy the viewport area remaining after margins of 10% at the top and bottom and 25% at the left and right. It SHALL provide a title and an `X` close control in the upper-right, and SHALL NOT display a back arrow. Its content SHALL scroll within the dialog when it exceeds the available height.

#### Scenario: Open a fullscreen Admin workflow
- **WHEN** an Admin workflow opens in the fullscreen dialog
- **THEN** the dialog is inset 10% from the viewport's top and bottom and 25% from its left and right
- **AND** its title and upper-right `X` close control remain available while overflowing content is scrollable

#### Scenario: Close an idle workflow
- **WHEN** the dialog is idle and the user activates the `X` or the platform's dialog-cancel action
- **THEN** the workflow closes and focus returns to the previously focused control when that control remains available

#### Scenario: Close is temporarily unavailable
- **WHEN** the hosted workflow marks closing as disabled during a protected operation
- **THEN** the `X` is disabled and the platform's dialog-cancel action does not close the workflow

### Requirement: Reusable Admin dialog content
The Admin fullscreen dialog SHALL accept workflow-owned content without imposing Mint Asset fields, wallet behavior, or workflow-specific actions. Reusing the dialog SHALL preserve the shared modal presentation, title association, close behavior, focus containment, focus restoration, and scroll behavior.

#### Scenario: Reuse for another Admin workflow
- **WHEN** another Admin workflow is hosted by the fullscreen dialog
- **THEN** it receives the same dialog frame and accessibility behavior without inheriting Mint Asset content or operations
