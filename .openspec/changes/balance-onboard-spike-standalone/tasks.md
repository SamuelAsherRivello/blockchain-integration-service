## 1. Standalone application

- [x] 1.1 Create independent Vite package and persistent encrypted fresh Signet identity; verify build and same public address after browser reload.
- [x] 1.2 Implement faucet address, fresh balances and automatic eligibility wait for a captured half-balance target; verify amount and eligibility tests.

## 2. Settlement and evidence

- [x] 2.1 Implement operator-compatible SDK two-settlement half onboarding with durable single-submission guards and automatic reconciliation; verify duplicate/uncertain and receipt evidence tests.
- [x] 2.2 Start a separate localhost server and open the app in a new browser tab; verify HTTP 200, real address, zero initial balances and document the preview URL.
- [x] 2.3 After user faucet funding and authorization, verify actual half-balance settlement, Bitcoin remainder and public commitment evidence; keep unchecked until the live transfer succeeds.

## 3. Revised owned steps

- [x] 3.1 Present six CPU/USER steps with approximate timing, explicit Create/Recreate and confirmation-gated Onboard 50%; verify browser creation/recreation/persistence, preserved original address, disabled unfunded onboarding, unit eligibility checks and build.
- [x] 3.2 Persist per-step timing history and calculated averages in local storage; verify completed-only arithmetic, missing-start and duplicate handling, reload persistence and visible browser sample calculations.
- [x] 3.3 Move recovery details to Step 1 and address to Step 2; use mnemonic identities for new accounts while preserving legacy keys, verify matching restored public identities and build, and keep recovery details hidden during browser checks.

Live acceptance verified 2026-09-09 in Chrome at http://127.0.0.1:5186/ on SDK 0.4.71: Step 6 reports 6,000 usable Arkade sats; both settlement commitments are confirmed. Original captured funding: 12,000 sats. Bitcoin returned: 6,000 sats. The later 1,761,610-sat deposit remains outside the operation.

- Boarding commitment: `82b2d197adc05ac22ec8ec5ef570dca7e4b38d8c47834da6520d0df8a87755f4`
- Bitcoin-return commitment: `a42d83a45135371c45c1264fa079d1c610b583a7dd1f06b5cf93bd5e2ba533e2`
