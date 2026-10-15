## MODIFIED Requirements

### Requirement: Fixed game wallet payment
An explicit eligible payment action SHALL send exactly 100 Signet sats from the selected F1 game wallet to the active preview player's Arkade receiving address. The system SHALL validate distinct identities, current recipient, available funds including fees and sender mutation eligibility before submitting. It SHALL preserve unrelated asset holdings and wallet isolation.

#### Scenario: Eligible payment
- **WHEN** the operator activates the action with two distinct ready accounts and sufficient spendable funds
- **THEN** one real 100-sat payment is submitted from F1 to the preview player
- **AND** any fee is accounted for separately from the recipient's 100 sats

#### Scenario: Ineligible sender or recipient
- **WHEN** either account is unavailable, the accounts match, funds including fees are insufficient, or a conflicting sender operation exists
- **THEN** no payment is submitted and the action is unavailable with truthful Admin feedback

### Requirement: Verified receipt notification
Only verified incoming evidence correlated to the F3 transaction, original recipient and exact 100-sat amount SHALL trigger `User <short sender ID> Sent You 100 Sats` in the original still-active preview session. The sender ID SHALL use its public profile ID's first four and last five characters separated by `....`; IDs of nine or fewer characters SHALL remain whole. The notification SHALL reuse shared toast ordering, default duration and runtime containment and occur at most once per payment status per operation. Submission acknowledgment or an uncorrelated balance increase SHALL NOT establish receipt.

#### Scenario: Player receives payment
- **WHEN** receipt is verified for the original active player session
- **THEN** one toast displays the exact message format with the actual shortened sender ID
- **AND** sender and recipient balances are refreshed from real data

#### Scenario: Failed or uncertain payment
- **WHEN** payment fails or incoming evidence is not yet sufficient
- **THEN** no final receipt toast appears and Admin reports the actual failed or pending status

#### Scenario: Duplicate evidence or departed session
- **WHEN** receipt events repeat, the player logs out, the preview context is replaced, or recovery occurs after reload
- **THEN** no duplicate or stale-session toast is delivered
- **AND** financial reconciliation remains independent of toast delivery
