# Tasks

## 1. Define the startup recovery contract

- [ ] 1.1 Update the project-run skill instructions to require owned-process restart, unrelated-port preservation, fallback-port selection, sidecar tolerance, and retained-server behavior when verification is blocked; verify the instructions match the recovery spec.
- [ ] 1.2 Add or update focused helper tests/fixtures for preferred-port restart, unrelated-port preservation, launch-race retry, and actual-port reporting; verify each fixture has an observable expected result.

## 2. Harden the Windows launcher helper

- [ ] 2.1 Implement conservative project-process ownership discovery with a PID/listener fallback and verified process-tree cleanup; verify unknown listeners are never terminated.
- [ ] 2.2 Implement bounded sequential port attempts with strict-port launch retries and cleanup between attempts; verify `EADDRINUSE` advances to the next port and leaves at most one project server.
- [ ] 2.3 Launch only through the repository's configured `npm run dev` command and capture diagnostics in the prescribed ignored output location; verify repositories without a root Vite config still start.
- [ ] 2.4 Return the selected port, route URLs, route status, application identity, and verification state; verify loopback access restrictions retain the live server instead of tearing it down.

## 3. Handle the optional faucet sidecar

- [ ] 3.1 Update the launcher/helper contract so a healthy shared Vite server is not marked failed solely because faucet port 5190 is occupied; verify the sidecar state is reported separately.
- [ ] 3.2 If required by the existing faucet implementation, add an explicit configurable sidecar port with a backwards-compatible default and verify an occupied default can use a fallback without taking over an unrelated process.

## 4. Integrate and verify the complete workflow

- [ ] 4.1 Run the helper against the declared shared route configuration with the preferred port occupied by this project and verify same-port restart.
- [ ] 4.2 Run it with the preferred port occupied by an unrelated listener and verify that listener survives while a fallback server starts.
- [ ] 4.3 Verify all configured routes and expected identities on the selected port, then verify duplicate project-owned servers are reconciled and the selected server remains running.
- [ ] 4.4 Run OpenSpec validation and the repository's relevant tests, and record the final verified command results.
