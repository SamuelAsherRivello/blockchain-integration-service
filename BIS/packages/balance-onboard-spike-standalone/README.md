# Standalone balance onboarding spike

Direct Arkade OS SDK 0.4.67 Signet experiment. No imports from BIS integration, no production wallet state, and no backend beyond Vite.

From the repository root with its existing dependencies installed:

```powershell
npm run dev --workspace @spike/balance-onboard
npm run build --workspace @spike/balance-onboard
npm run test --workspace @spike/balance-onboard
```

Open http://127.0.0.1:5186/ in the same browser for the whole experiment. This port is deliberately distinct from the main demo. It runs locally on Windows; no SSH tunnel is required.

The six steps identify ownership and approximate duration: CPU Create account; USER Open faucet and fund; CPU Wait for incoming Bitcoin; USER Onboard 50%; CPU Track Bitcoin to Arkade; CPU Confirm usable Arkade funds. Create is explicit on a fresh origin. Recreate retains the previous encrypted account and operation in browser storage and is blocked while a transfer is unresolved.

Copy the public address and click **Open faucet and fund**. Incoming transaction evidence appears in Step 3 automatically. **Onboard 50%** is enabled only after funding confirms and is eligible. The click revalidates and freezes the funded input set. No transfer is authorized merely by opening the faucet or waiting. Keep the tab open during signing. A reload preserves the identity and operation but cannot resume an interrupted signing session; it checks the existing attempt without re-registration. All status checks retain the five-second countdown.

Half the captured sats (rounded down) is the required Arkade output. Automatic boarding is disabled. Currently the exact output checks support the zero fee schedule; a changed/nonzero schedule blocks submission rather than changing the net amount. Dust, expiry and operator limits also block invalid transfers.

The identity is encrypted with a browser-local non-extractable AES key in a dedicated IndexedDB database. Step 1 offers explicit Reveal/Hide and Copy controls for recovery details; Step 2 holds the public boarding address. Recovery details are initially hidden, cleared from the page after 60 seconds, on account recreation, or when the tab is hidden, and never logged or placed in timing storage. Do not clear site data while funds or an operation remain.

New accounts store a 12-word BIP39 phrase and restore with `MnemonicIdentity.fromMnemonic(phrase, {isMainnet:false})`. Existing accounts retain their random private key and original address; Step 1 labels them as private-key accounts and identifies `SingleKey.fromHex` as their restore method. A seed phrase cannot be retroactively substituted for these wallets. Recreation does not convert or migrate existing funds. Store recovery details privately and enter them directly in the development app, never in chat or committed configuration.

Success requires confirmed commitment input spends, exact Bitcoin change and linked spendable Arkade receipts. Registration alone is pending. Network errors keep the saved operation intact. The isolated automated tests do not establish live funded acceptance.

Verification on 2026-09-09: Vite HTML HTTP 200; fresh real Signet address with zero initial Bitcoin/Arkade balances; same public address after reload; production build and focused tests pass. Actual faucet funding and settlement await the user's next step.

## Step timing history

Local storage key `standalone-arkade-step-timings-v1` stores per-account step start/end timestamps, completed durations and per-step `{count, totalMs, averageMs}`. Average is total completed milliseconds divided by completed samples. The UI shows this calculation, sample count and current elapsed time. Historical averages replace the rough estimate when available. No wallet secrets or addresses are stored in timing history.

Measurement boundaries: Create/Recreate click to address ready; faucet opened to first deposit detection (a proxy including user/faucet time); first deposit detection to confirmed eligibility; eligibility to onboarding click (includes user delay); submission to commitment observed; commitment observed to verified usable funds. Existing steps without recorded starts are not backfilled. Failed or uncertain/in-progress steps do not count as completed samples. Closing the browser does not pause wall-clock timing. Repeated observations, reopening and duplicate clicks do not add samples or reset start times. Recreated accounts contribute independent samples on the same origin. Timing-storage failures do not stop wallet processing.
