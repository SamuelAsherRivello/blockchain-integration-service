# Tasks

## 1. Early role address preparation

- [x] 1.1 Implement SDK-equivalent address projection from the existing role slot's validated configuration; verify exact normal-wallet parity and earlier completion with delayed wallet initialization in focused tests.
- [x] 1.2 Wire session address borrowing and Player prepared-address reuse; verify shared initialization, cancellation, failed/mismatched configuration, retirement, replacement/network guards, and unchanged role-wallet budget with focused integration tests and typecheck.

## 2. Marketplace labels

- [x] 2.1 Replace global address fallback with independent scoped label presentation, remove duplicate Game refresh, and reveal known connected Game addresses independently of catalog; verify loading/unavailable/disconnected/ready and identity/network replacement with focused tests.
- [x] 2.2 Add Playwright cold-navigation and reload acceptance using two isolated test identities and delayed ownership reads; verify both labels under 1,000 ms with configuration responses within 250 ms, plus failure/logout/network cases and no signing or live mutations.

## 3. Integrated verification and handoff

- [x] 3.1 Run focused regression suites, typecheck, and strict OpenSpec validation; inspect actual rendered labels and console/network evidence through playwright-cli against shared 5174, and record controlled versus live timing limits in verification.md.
- [x] 3.2 Audit completed behavior against both delta specs and hand coordinator the stable exact source/test scope and verification evidence before canonical export; confirm the handoff names every affected file and all limitations.
