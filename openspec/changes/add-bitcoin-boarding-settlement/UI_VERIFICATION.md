# Account Transfer UI verification

UI delivery on 2026-09-04; real transfers remain pending.

- Account Details uses Total first and Bitcoin/Arkade fields side by side, retaining separate Copy actions. Bitcoin <-> Arkade opens Account Transfer immediately above Recovery Phrase.
- The adapter validates SDK boarding.total and derives full Arkade holdings as total minus boarding. Spendable availableSats is retained as a separate public field for compatibility, never relabeled as full Arkade holdings.
- The isolated transfer browser host passed split accounting, side-by-side layout, entry, direction selection, plus adjustment, review, disabled confirmation/Max, Back/reopen reset, failed reads and no card overflow at the normal narrow card width. No real storage or transactions were used in this fixture.
- Production Chrome D4 opened Account Transfer for the saved account. Live amounts were Total 289,715 sats, Bitcoin 289,715 sats, Arkade 0 sats. Back returned to Account Details and initiated a fresh read. No recovery phrase, account reset, logout, funding or settlement was used.
- New node tests first failed on missing split values and transfer navigation, then passed. All 60 integration tests passed. Production build/typecheck passed. Strict OpenSpec validation passed.
- Max, fees, resulting-balance quotes, Confirm Transfer, partial transfer execution and reverse withdrawal remain unavailable. The UI cannot submit a wallet transaction. Remaining live-feature tasks stay unchecked; achievement feasibility remains separate.
