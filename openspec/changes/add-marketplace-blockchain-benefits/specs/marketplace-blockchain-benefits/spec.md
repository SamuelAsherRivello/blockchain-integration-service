## Purpose

Explain the value of the Marketplace's Web3 systems without requiring a visitor to connect an account, load wallet data, or start a transaction.

## ADDED Requirements

### Requirement: Public Marketplace benefits dialog

The public Marketplace landing page SHALL make the word `before` in its shop-before-play lede an accessible control. Activating that control SHALL open a centered dialog titled `Blockchain Benefits` with the `Marketplace` category. The dialog SHALL be dismissible using its close control or backdrop and SHALL not start a wallet operation, network operation, item-detail dialog, or trade.

#### Scenario: Visitor opens and dismisses the benefits dialog

- **WHEN** a visitor activates `before` in the Marketplace lede
- **THEN** the visitor sees the centered `Blockchain Benefits` dialog in the `Marketplace` category
- **AND** dismissing it returns the visitor to the same public Marketplace state

### Requirement: Marketplace benefit examples

The Blockchain Benefits dialog SHALL list Marketplace, Account / Wallet, Assets, Contracts, and Payments. Each listed heading SHALL include a five-to-ten-word explanation containing a Stealth & Steel example.

#### Scenario: Visitor reads the benefit list

- **WHEN** a visitor opens the Blockchain Benefits dialog
- **THEN** the dialog presents all five requested headings
- **AND** every heading has a concise Stealth & Steel example explaining its value
