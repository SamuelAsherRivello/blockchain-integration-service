## Context

See proposal.md. Arkade OS SDK 0.4.67 exposes a partial Ramps.onboard helper, but the Signet operator rejects boarding inputs combined with onchain outputs (INVALID_INTENT_PROOF, code 23). Use two settlements: board the captured Bitcoin total with no onchain output, then return the Bitcoin remainder from the resulting Arkade receipt. Production code is reference evidence only and is not imported.

## Goals / Non-Goals

Goals: independent real Signet experiment, persistent fresh identity, a single authorized half-balance onboarding, observable settlement evidence.
Non-goals: BIS fixes, production wallets, general withdrawal UI, mainnet, automatic replay of uncertain registrations.

## Decisions

- Plain TypeScript and CSS in a standalone Vite package, direct SDK dependencies and a dedicated localhost port. No production integration imports.
- Store the fresh key encrypted with a non-extractable browser CryptoKey in an isolated IndexedDB database. Retain public operation state across reopening. No secret rendering or logging.
- Disable automatic SDK settlement. Watch incoming funds automatically, enable the user onboarding button only after confirmation and eligibility, and revalidate the funded UTXO set on the click. Freeze floor(total/2) as the net target. Later deposits do not change an authorized snapshot. Legacy pre-funding authorization returns to idle and requires a new user click.
- Present six numbered CPU/USER steps with rough time estimates. Create is explicit on a fresh browser. Recreate archives the old encrypted identity and operation in the same atomic IndexedDB transaction that activates the new account. Unresolved transfers prevent recreation; account IDs prevent old tabs from submitting against a replacement account.
- Construct and inspect SDK settlement outputs before submission; require boarding of the full captured total followed by an exact target Arkade remainder and owned Bitcoin return. Display verified fees and refuse unsupported schedules or invalid dust rather than silently onboard a different amount.
- Persist submission before calling the network and serialize across tabs. Record intent ID and commitment as they become available. After interruption, reconcile only; never re-register an uncertain intent.
- Verify the first commitment spends the captured inputs and confirms; verify the second commitment confirms the expected Bitcoin return and is linked to owned spendable VTXOs of the target value before success. Persist each settlement leg and separate registration guard. Keep checking automatically on uncertain outcomes, including after reopening (question 5 confirmed).

## Risks / Trade-offs

- Operator availability, confirmations or a interrupted signing session can delay completion indefinitely -> display last stage, fresh-read failures and public identifiers without claiming completion.
- Browser-local encryption does not protect against same-origin malicious scripts -> isolated origin, no third-party page scripts, test funds only.
- The operator rejects mixed boarding/Bitcoin-output intents -> use the supported two-settlement flow; intermediate Arkade balance temporarily equals the whole captured total. Later deposits remain untouched.

## Migration Plan

Additive package only. Run on a distinct localhost port and open a new browser tab. Stop its server to retire the experiment; retain its browser data for outstanding test funds.

## Live debugging decision (2026-09-09)

User explicitly authorized retrying the failed Signet attempt until completion. Preserve previous operation snapshots before a manual retry, require original inputs still unspent, and never automatically replay a failed registration. Only the separately persisted Bitcoin-return leg may start automatically after the successful boarding leg. Error diagnostics persist safe operator codes and categories without provider metadata or proof payloads.
