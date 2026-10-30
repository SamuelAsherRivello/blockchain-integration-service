# Spec Delta

## Purpose

Keep the sandbox Send Asset demo on an ordinary spendable carrier amount while sending exactly the selected sats and one unit of the selected asset.

## ADDED Requirements

### Requirement: Practical carrier minimum
Send Asset SHALL offer exactly 330 and 1000 sats, defaulting to 330. Its description and brief label tooltip SHALL state the 330-sat minimum. A helper paragraph SHALL NOT be added.

#### Scenario: New or existing selection
- **WHEN** a profile has no selection or a saved selection of 0, 1 or 100
- **THEN** it selects 330 sats, while a saved 1000-sat choice remains unchanged

### Requirement: Exact transfer value
The executable demo SHALL pass the validated selected carrier amount to the real SDK with one unit of the selected asset. Unsupported values SHALL fail before sending.

#### Scenario: Minimum send
- **WHEN** the user sends an asset with the 330-sat selection
- **THEN** the recipient output contains exactly 330 sats and one unit of that asset
