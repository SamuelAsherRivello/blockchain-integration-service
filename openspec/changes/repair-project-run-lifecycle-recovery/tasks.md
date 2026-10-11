# Tasks

## 1. Helper recovery and evidence

- [x] 1.1 Replace early log-only launch success with listener/process readiness and require a successful configured-route identity check before reporting a candidate as verified; verify with the project-run recovery tests.
- [x] 1.2 Repair Windows listener and ownership fallbacks so unavailable CIM inspection does not misclassify occupied ports, and retry bind races while preserving unrelated listeners; verify with mocked/fallback port scenarios.
- [x] 1.3 Make detached-process lifetime explicit, reconcile failed/orphaned candidate trees, and preserve a live server when only sandbox HTTP observation is blocked; verify with process-tree and pending-verification scenarios.
- [x] 1.4 Keep Vite startup independent from the optional faucet sidecar, select/report a sidecar fallback or sidecar failure separately, and verify all main routes remain checkable; verify with the sidecar-conflict scenario.

## 2. Lifecycle skill alignment

- [x] 2.1 Update `ai-skills-project-run-start` with the evidence tiers, retry matrix, attached-session fallback, and rule that no URL is reported as verified without listener and HTTP identity evidence; verify the skill references the helper behavior accurately.
- [x] 2.2 Update `ai-skills-project-run-stop` to use the same ownership fallbacks, stop only confirmed project trees, and report residual processes/listeners without escalating to global process termination; verify its read-only discovery and scoped termination sequence.
- [x] 2.3 Update `ai-skills-project-run-status` to classify process-only, listener-only, healthy, duplicate, and host-verification-pending states without starting or stopping anything; verify its route/status reporting contract.

## 3. Integration verification

- [x] 3.1 Run the targeted recovery tests and OpenSpec validation, then perform a start/status/stop smoke check that proves the one-server invariant and records the actual selected port.
