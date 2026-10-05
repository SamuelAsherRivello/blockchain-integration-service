## MODIFIED Requirements

### Requirement: Truthful pre-trading detail

Selecting a catalog card SHALL open its detail view with the asset identity,
game effect, tier, and ownership/trading state available to the current
visitor. Asset ID, Ticker, Quantity, Speed, Offense, and Defense SHALL each
appear as a labeled, contained read-only value field with an accessible Copy
action named for its label. Each value SHALL remain selectable for manual
copying, and the detail SHALL provide truthful feedback for successful or
unsuccessful clipboard copying. Each field's label, value, and copy control
SHALL use the same left-aligned type treatment. Decimals SHALL NOT be displayed. The detail
SHALL be square and SHALL NOT present an internal scrollbar. Before the
trading capability is available, Buy and Sell controls SHALL be visibly
disabled in an upper-right action column; they SHALL NOT request login, create
a transaction, or imply a price, sale, or listing. The detail SHALL NOT show
bottom verification/status/footer copy.

#### Scenario: Guest selects an item before trading exists

- **WHEN** a logged-out visitor opens Dagger II before authenticated trading
  is delivered
- **THEN** the detail view describes Dagger II, displays its labeled,
  copyable Asset ID, Ticker, Quantity, Speed, Offense, and Defense fields
- **AND** it does not display Decimals, an internal detail scrollbar, or
  bottom verification/status/footer copy
- **AND** it displays disabled Buy and Sell controls in the upper-right action
  column
- **AND** the visitor can return to the public catalog without any account or
  wallet side effect

#### Scenario: Guest copies an item detail value

- **WHEN** a visitor selects Copy for an open catalog-item detail value
- **THEN** the Marketplace copies that full displayed value when clipboard
  access succeeds and confirms that result
- **AND** when clipboard access fails, the Marketplace keeps the full value
  selectable and explains that it can be copied manually
