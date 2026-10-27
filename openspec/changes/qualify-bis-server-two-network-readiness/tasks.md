# Tasks

## 1. Network-scoped configuration and policy

- [x] 1.1 Audit Signet and Mutinynet runtime configuration, environment isolation, caps, and state namespaces; add or correct any gap and verify focused server tests prove there is no cross-network fallback. (Evidence: `output/reports/bis-server/two-network/2026-10-27/network-policy-acceptance.md`; added explicit regression coverage for duplicate identity deduplication and no cross-network fallback.)
- [x] 1.2 Verify the three-slot candidate policy on both networks using fresh balance responses, including missing, malformed, duplicate, unknown, insufficient, and operation-appropriate balances; record deterministic results without exposing secrets. (Evidence: focused wallet-pool suite exercises each condition with deterministic balance readers; see report.)
- [x] 1.3 Verify existing and interrupted operations remain pinned to their original network and signer across balance changes, backend restarts, and manual fallback; record regression coverage. (Evidence: client-selection and signing-store checkpoint suites cover balance drain, cancellation, network replacement, cold instances, exact replay, and unresolved-operation quarantine; see report.)

## 2. Hosted network acceptance

- [ ] 2.1 Configure private Signet and Mutinynet test identities independently in the existing free-tier Vercel project and datastore; verify health and public identity routes for both without exposing secret values.
- [ ] 2.2 Exercise deployed policy rejection, request binding, quotas, idempotency, replay protection, concurrency, and cold starts separately on Signet and Mutinynet; save sanitized evidence under `output/reports/bis-server/two-network/`.
- [ ] 2.3 Complete bounded real Signet signing acceptance using approved test wallets; verify actual network evidence and reconcile the operation before any competing spend.
- [ ] 2.4 Complete bounded real Mutinynet signing acceptance using its separate approved test wallets; verify actual network evidence and reconcile the operation before any competing spend.

## 3. Consumer release and closeout

- [ ] 3.1 Update BIS clients and documentation to enable both hosted networks after acceptance; verify Mutinynet remains explicitly unavailable when its server configuration is absent.
- [ ] 3.2 Export and import the exact verified BIS package into Stealth & Steel; verify package hash, dependency lock, endpoint configuration, and matched release versions.
- [ ] 3.3 Run focused and full BIS/game suites, production builds, real contract checks, and deterministic server-absent fallback checks; publish both Pages workflows and verify public routes and identities.
- [ ] 3.4 Write the two-network acceptance report with per-network deployment, live signing, consumer, release, and rollback evidence; run `openspec validate` and confirm every scoped task is complete.
