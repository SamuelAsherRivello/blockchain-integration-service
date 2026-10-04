# Prototype onboarding

[Back to the main README](../../../README.md)

`@spike/prototype-onboarding` is an independent Signet experiment for measuring and investigating Bitcoin-to-Arkade onboarding. It uses the Arkade SDK directly rather than importing the BIS integration library. Its account, operation history, and timing data are separate from the Admin and Marketplace wallets. The browser application is intended for observing real network behavior and recovery, not for supplying the production game's Account interface.

## Onboarding flow

The interface divides a run into six steps: create an account, open a faucet and fund it, wait for incoming Bitcoin, onboard the selected percentage, track Bitcoin-to-Arkade settlement, and confirm usable Arkade funds. Each step identifies whether the user or the application owns the next action. Estimated duration, elapsed time, and recorded observations help explain progress without equating registration with completion.

Account creation is explicit on a fresh window. Seed Phrase Creation supports Auto and Manual modes. Restart either generates a phrase or requests a valid phrase locally, after confirmation. Replacing the current account archives the previous account and operation state; it does not cancel submitted transactions or move funds from the previous wallet. Cancel leaves the current run unchanged. Recovery input belongs directly in the application, never in chat, logs, or committed configuration.

After the user funds the displayed public boarding address, the application observes incoming transactions. Eligible confirmed funding can trigger automatic onboarding for an idle operation. The selected percentage establishes the intended final Arkade amount from the captured inputs. The input set is frozen for the operation so later deposits or repeated refreshes cannot silently expand the transfer or create a duplicate submission.

For partial onboarding, the existing workflow boards the captured total and then returns the non-target remainder in a second settlement. The intermediate whole-total Arkade balance is not the requested final result. Exact-output, fee, dust, expiry, and provider checks can prevent submission. A changed fee schedule must not silently alter the promised target. Full onboarding follows the corresponding zero-change path.

## Persistence and recovery

Each active window has its own account database, preferences, timing history, and operation locks. The URL carries a window identifier and can include the public boarding address. Reloading retains that window's state; opening an already-active window URL in another tab establishes separate state. These identifiers are coordination and display metadata, not wallet credentials or signing inputs.

Account material is encrypted in a dedicated browser database. Recovery details start hidden and are exposed only through explicit local controls. They are cleared from the page when the relevant visibility or lifecycle conditions apply and must not enter timing records. Existing private-key accounts retain their original restore method; a seed phrase cannot be substituted retroactively for those identities.

Network errors retain the saved operation for reconciliation. Automatic recovery uses the recorded inputs and SDK state, with retry delays and cleanup of obsolete work. Success requires the relevant confirmed commitments and exact usable output evidence. A submitted or registered operation remains pending until those checks establish the result. Historical measured runs demonstrate observed outcomes, not a guaranteed completion time for future runs.

## Run and verify

Run `npm run dev` from the repository root and open the printed `/onboarding/` URL on the shared server. The default port is `5174`. For isolated development, `npm run dev --workspace @spike/prototype-onboarding` retains the package's separate server on port `5186`. Accounts saved on one origin are not automatically available on the other.

Run `npm run test --workspace @spike/prototype-onboarding` for the standalone checks and `npm run build --workspace @spike/prototype-onboarding` for its build. Automated tests use controlled conditions and do not establish funded live acceptance. See [user-story documentation](../../documentation/User%20Story%20Diagrams.md) and the [archived robustness verification](../../../openspec/changes/archive/2026-09-09-robust-fixes-for-spike/verification.md) for recorded evidence, acceptance scope, and remaining limitations.
