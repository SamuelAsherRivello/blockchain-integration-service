## ADDED Requirements

### Requirement: Three transaction detail actions
Transaction Detail SHALL retain its Transaction label, inline copy icon, and selectable report. Its action area SHALL contain exactly View Recovery Info, Open On Explorer, and Back, in that order. View Recovery Info SHALL be disabled when no recovery report exists for the selected record. Open On Explorer SHALL remain disabled without a supported explorer URL, with its reason accessible on the control. The view SHALL NOT show a bottom explorer-unavailable text block or additional bottom textfield. Detail Back SHALL return to Transactions and retain selection.

#### Scenario: Pending transaction without an explorer identifier
- **WHEN** a pending transaction with recovery information but no explorer URL is opened
- **THEN** the three actions are visible, View Recovery Info is enabled, Open On Explorer is disabled, and no explanatory textfield or explorer message appears below Back

#### Scenario: Ordinary transaction
- **WHEN** a transaction has no recovery report
- **THEN** View Recovery Info remains visible and disabled, and the existing explorer and Back behavior remains available as appropriate

### Requirement: Matching recovery information dialog
View Recovery Info SHALL open a dialog inside the BIS overlay with visible title Recovery Info. It SHALL match Transaction Detail typography, colors, report styling, compact card layout and internally scrolling report. A Recovery Info label SHALL have an adjacent copy icon above a selectable read-only report for the selected transaction. Back SHALL be the only footer action and SHALL dismiss the dialog, leaving the originating Transaction Detail selection intact. There SHALL be no Check Status, standalone Copy Recovery Details, discard, explorer, or refresh action in this dialog. Report generation and copying SHALL remain read-only and secret-free.

#### Scenario: Open and return
- **WHEN** the player selects View Recovery Info and then Back in the new dialog
- **THEN** the matching Recovery Info dialog closes and the original selected Transaction Detail remains open

#### Scenario: Clipboard failure
- **WHEN** copying fails
- **THEN** the dialog retains selectable report text and truthful accessible feedback without additional action buttons

#### Scenario: Dialog navigation stays inside BIS
- **WHEN** Recovery Info opens
- **THEN** no browser window is created, the originating card is inert, keyboard focus stays inside the recovery dialog, and Back or Escape restores the originating detail and trigger focus

#### Scenario: Copy selected recovery report
- **WHEN** the player activates the copy icon beside Recovery Info
- **THEN** only the selected recovery report is copied and success is indicated only after the clipboard write succeeds
