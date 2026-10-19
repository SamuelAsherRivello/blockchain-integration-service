# Verification

## Automated

- `npm run typecheck` passes.
- `npm run build` passes for integration, integration-admin, marketplace, and faucet.
- The escrow lifecycle unit tests pass, including approval gating and approval-at-creation.
- OpenSpec strict validation passes.
- The full repository test command reaches the new escrow tests successfully; unrelated existing Windows sandbox tests can fail with `EPERM` temporary-file rename errors.
- This repository does not define an `npm run lint` script.

## Capability and live-workflow limits

- The installed Arkade SDK is `@arkade-os/sdk` 0.4.79. Its public declarations contain no separate sender-approval primitive. `Approve Escrow` is therefore a sender-authenticated BIS gate around the existing Arkade LTO fund/claim/refund path.
- The current LTO path enforces the verified zero-fee policy and presents fee evidence as 0 sats when available.
- A real funded Signet run was not performed in this change because it requires the user's selected and funded Game Wallet and Player Wallet. Live funding, repeated status checks, receipt, timeout/refund, and provider evidence remain acceptance steps.
