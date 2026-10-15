# bis-ui-style-isolation Specification

## Purpose
Ensure production BIS views present one stable visual language when embedded in Admin, game, Marketplace, or another supported host. Host applications may position BIS but cannot unintentionally change its internal typography or component presentation.

## Requirements

### Requirement: Consistent BIS visual presentation

Every production BIS view SHALL use the same BIS-owned visual rules across supported hosts at the same supported display scale, including font family, font size, font weight, line height, letter spacing, text casing, color, alignment, spacing, borders, and control styling.

#### Scenario: Accounts Details in multiple hosts
- **WHEN** the same Accounts Details view is opened in Admin, a game host, and Marketplace at the same supported scale
- **THEN** its headings and field labels have the same casing, typography, spacing, colors, and control presentation
- **AND** host-specific page backgrounds or surrounding layouts do not alter those BIS-owned properties

#### Scenario: Responsive host size
- **WHEN** a host provides a narrower or wider supported container
- **THEN** BIS may apply its documented responsive sizing behavior
- **AND** responsive adaptation SHALL NOT change the visual token, casing, or component style selected for the BIS view

### Requirement: BIS style boundary

Production BIS styling SHALL be isolated from host stylesheet inheritance and broad host selectors. A consuming host SHALL be permitted to control only documented mounting, visibility, placement, stacking, and outer-container sizing behavior, and SHALL NOT re-theme or re-typography `.bis-*` descendants.

#### Scenario: Marketplace host CSS is loaded
- **WHEN** Marketplace CSS is loaded alongside the production BIS stylesheet
- **THEN** Marketplace selectors do not change the computed typography or presentation of BIS headings, labels, buttons, dialogs, or fields
- **AND** Marketplace-specific catalog elements retain their own styling

#### Scenario: Host positions the closed Account launcher
- **WHEN** a host applies documented placement styling to the closed Account launcher
- **THEN** the launcher appears at the requested host-local position
- **AND** opening the BIS view preserves the shared BIS presentation and documented centering behavior

### Requirement: Cross-context style verification

The project SHALL verify representative production BIS views in Admin, game-host, and Marketplace contexts against the shared visual contract. Verification SHALL cover at least one heading, one field label, one balance label, one action button, and one navigation control.

#### Scenario: Style drift is introduced
- **WHEN** a host stylesheet changes a protected BIS visual property
- **THEN** the cross-context verification reports the affected view or property as failing
- **AND** the change is not considered verified until the host rule is removed, scoped away from BIS, or the shared contract is deliberately updated

#### Scenario: Shared BIS style changes intentionally
- **WHEN** an intentional BIS visual change is made
- **THEN** the same updated presentation is verified in every supported host fixture
- **AND** no host-specific exception is added solely to preserve a prior divergent rendering
