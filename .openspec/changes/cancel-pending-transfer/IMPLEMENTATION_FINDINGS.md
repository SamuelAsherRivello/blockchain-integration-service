# Cancellation prerequisite findings — 2026-09-04

Apply paused at 1.2. Task 1.1 is complete; no runtime changes, signing, cancellation requests, journal clearing, funding or replacement payments were performed. No unavailable cancellation UI was added.

## Parent and current checkout

Inspected the parent transfer requirements/design, current cancellation artifacts, affected checkout changes and account-storage guard diff. The parent read-only requirement now explicitly permits only the separately confirmed cancellation capability after its own safety gates pass. Check Status remains read-only; automatic cancellation/re-registration remains prohibited. Existing unrelated changes are preserved.

## Installed SDK evidence

Installed `@arkade-os/sdk` is 0.4.67. Its public `Intent.create`, `Intent.encodeMessage`, signing identity and `RestArkProvider.deleteIntent` provide proof-construction primitives without invoking the private wallet helper. `Intent.DeleteMessage` contains type and expiry, not an intent ID. The bundled `makeDeleteIntentSignature` constructs an ownership proof from coins and empty outputs. This establishes available primitives, not verified reconstruction/ownership for the user's recorded inputs or safe terminal cancellation.

References: `node_modules/@arkade-os/sdk/dist/index-DU5o_hz7.d.ts`, Intent namespace and ArkProvider; `dist/chunk-AEWJU6NZ.js`, makeDeleteIntentSignature. Official [intent lifecycle](https://docs.arkadeos.com/arkd/components/intent-system) documents proof-based deletion, not sufficient active-batch finality evidence.

## Operator/source evidence

A read-only GET of `https://signet.arkade.sh/v1/info` returned network `signet` and an empty version string. Therefore the deployed implementation cannot be tied to an upstream commit using this response.

Inspected upstream commit `f863e484719344edbe4a8d10cf5fe994b123f2c0`, not asserted to be deployed:

- [service.go](https://github.com/arkade-os/arkd/blob/f863e484719344edbe4a8d10cf5fe994b123f2c0/internal/core/application/service.go): `verifyIntentProofAndFindMatches` selects queued intents sharing any proof outpoint. `DeleteIntentsByProof` separately deletes all matched IDs. It does not compare our expected intent ID or return a terminal-outcome receipt.
- [in-memory intent store](https://github.com/arkade-os/arkd/blob/f863e484719344edbe4a8d10cf5fe994b123f2c0/internal/infrastructure/live-store/inmemory/intents.go): `ViewAll`, `Pop` and `Delete` acquire separate locks. `Pop` moves intents into `selectedIntents` and removes them from the queue. `Delete` ignores IDs absent from the queue and returns nil; it does not remove selected intents.

Source-level race: proof lookup finds queued intent A; batch Pop selects A; deletion finds no queued A and returns nil. Thus that implementation's successful delete response does not establish that A cannot settle. This is source analysis, not a race executed against the live service, and does not assert the live operator uses its in-memory store.

Deletion uses input overlap rather than exact operation ID, and no replay tombstone or terminal receipt is established by the inspected path. A bounded proof expiry limits proof validity but does not prove terminal cancellation of the original registered intent. The deployed targeting, batch exclusion and replay guarantees remain unverified.

## Eligibility matrix

| Recorded state / direction | Eligibility | Reason |
| --- | --- | --- |
| Prepared, never registered; either direction | No signed cancellation needed | Existing prepared recovery under the mutation lock applies. |
| Registered Bitcoin-to-Arkade | Blocked | Deployed scope/finality and exact boarding-input reconstruction not proven. |
| Registered Arkade-to-Bitcoin | Blocked | Deployed scope/finality and exact VTXO reconstruction not proven. |
| Missing intent ID / unknown registration | Blocked | Cannot safely attribute cancellation to the recorded intent. |
| Commitment recorded | Check Status | Verify original transfer completion; do not promise reversal. |

## Required external evidence

Obtain the operator's deployed version and an authoritative exact-intent cancellation/status contract that excludes an already-selected batch and establishes replay behavior. Alternatively, obtain authoritative terminal outcome evidence for the recorded intent so existing recovery can resolve it. No outreach was sent. Merely approving apply again does not supply this evidence.

Do not implement an acknowledgement-as-success shortcut, force-clear the journal or ship unavailable controls. Task 1.2 and all dependent implementation/live tasks remain unchecked.
