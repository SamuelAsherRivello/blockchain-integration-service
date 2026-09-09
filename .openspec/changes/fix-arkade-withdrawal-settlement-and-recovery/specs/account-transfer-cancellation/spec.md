## ADDED Requirements

### Requirement: Capability-verified interrupted withdrawal recovery
An interrupted withdrawal SHALL provide operation-specific completion inspection and a truthful recovery capability result. Any ownership-authorized intent lookup SHALL distinguish current registration matches from terminal history and match all returned intents to the selected operation. Cancellation SHALL remain unavailable unless its scope and resolution guarantees exclude unintended intents and later settlement of the cancelled attempt. Lack of support SHALL identify the missing capability without releasing reservations or claiming recovery is implemented.

#### Scenario: Multiple lookup matches
- **WHEN** ownership-authorized lookup returns several intents and exact cancellation scope cannot be proven
- **THEN** the operation remains unresolved and cancellation is unavailable with an ambiguity reason

#### Scenario: Absent or unavailable lookup
- **WHEN** lookup is unsupported, unreachable or returns no matching intent without established terminal semantics
- **THEN** the result does not establish cancellation and existing recovery identifiers and reservations remain intact

#### Scenario: Cancellation races settlement
- **WHEN** a reviewed cancellation overlaps selection or completion of the original settlement
- **THEN** verified settlement is recognized as completion and cancellation success is reported only when its terminal guarantee is established
- **AND** no conflicting reuse or replacement transfer occurs

#### Scenario: Existing interrupted operation acceptance
- **WHEN** recovery is accepted as delivered for an existing interrupted withdrawal
- **THEN** evidence identifies that original operation and its verified completion or terminal cancellation
- **AND** sufficient eligible funds become usable without logout, journal clearing or replay

## MODIFIED Requirements

### Requirement: Signing and privacy boundary
Cancellation SHALL be Signet-only and limited to an explicitly confirmed ownership proof for the eligible recorded operation. Ordinary inspection, restoration and Check Status SHALL remain read-only. A separately and explicitly confirmed ownership-authorized lookup MAY sign a query only when supported, SHALL explain that it inspects intent ownership rather than moving funds, and SHALL be bound to the reviewed account and inputs. Neither lookup nor cancellation SHALL enable automatic settlement, submit replacement payments or persist, log, copy or display private keys, recovery phrases or signed proofs. Public host-facing cancellation data SHALL contain no vendor-specific signing types or secrets.

#### Scenario: Read-only recovery
- **WHEN** the account is restored or Check Status runs for a pending cancellation
- **THEN** no signing or mutation occurs and only sanitized public status is exposed

#### Scenario: Explicit ownership lookup
- **WHEN** the user confirms supported ownership-authorized lookup for the still-current operation
- **THEN** only the query proof is signed and sent to the configured operator
- **AND** no cancellation, transfer or automatic replay is requested and no proof is retained or exposed
