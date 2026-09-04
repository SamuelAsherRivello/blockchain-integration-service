# Cancel Pending Transfer feasibility — 2026-09-04

## Result: gate not passed

No cancellation code/UI was implemented and no signing, cancellation request, journal clearing or transfer submission was performed. Per the confirmed feasibility-first decision, do not proceed with implementation until exact targeting and deployed terminal-outcome semantics are established. Task 1.2 remains incomplete.

## Evidence

- Installed `@arkade-os/sdk` is 0.4.67. Its public provider accepts a signed intent proof/message for `deleteIntent`; the request is not an operation-ID/intent-ID cancellation request. Public Intent construction and identity signing primitives exist, but a safe exact-operation adapter has not been validated.
- GET `https://signet.arkade.sh/v1/info` returned network `signet`; selecting its `version` property returned no value. This check did not establish the deployed server commit or storage backend.
- Inspected upstream arkd commit `f863e484719344edbe4a8d10cf5fe994b123f2c0`, not asserted to be the deployed Signet version.
- In [application service](https://github.com/arkade-os/arkd/blob/f863e484719344edbe4a8d10cf5fe994b123f2c0/internal/core/application/service.go), `verifyIntentProofAndFindMatches` finds cached intents with overlapping proof outpoints. `DeleteIntentsByProof` then separately invokes the cache Delete method with matching IDs; no matches is an error. It does not return a terminal-outcome receipt tied to the requested intent ID.
- In [in-memory intent store](https://github.com/arkade-os/arkd/blob/f863e484719344edbe4a8d10cf5fe994b123f2c0/internal/infrastructure/live-store/inmemory/intents.go), Pop removes selected intents from the queue map and records them separately. Delete only removes present queue entries and silently skips absent IDs. Matching and deletion are not demonstrated to be atomic with batch selection. Thus an acknowledgement alone does not establish that a matched intent was not selected between those operations. This is a source-level risk, not proof that the user's live transfer experienced that race.
- The [handler](https://github.com/arkade-os/arkd/blob/f863e484719344edbe4a8d10cf5fe994b123f2c0/internal/interface/grpc/handlers/arkservice.go) returns an empty DeleteIntentResponse on service success. The [official lifecycle documentation](https://docs.arkadeos.com/arkd/components/intent-system) likewise describes ownership-proof deletion and an empty response, without establishing the required active-batch finality guarantee.

## Eligibility matrix

| Operation | Proof transport | Exact intent targeting | Deployed terminal evidence | Implementation gate |
| --- | --- | --- | --- | --- |
| Bitcoin to Arkade | SDK primitive exists; boarding proof adapter not verified | Input-overlap matching inspected; exact scope not established | Not established | Blocked |
| Arkade to Bitcoin | SDK primitive exists; VTXO proof adapter not verified | Input-overlap matching inspected; exact scope not established | Not established | Blocked |
| Unknown registration / missing intent ID | Not attempted | Cannot attribute accepted intent safely | Not established | Blocked |

## Required next evidence

Establish the deployed operator revision/backend and an authoritative cancellation contract excluding an already-selected or later-settling intent, including exact-input scope and lost-response recovery. The reviewed upstream methods do not establish those guarantees. Operator investigation or an upstream-supported API/contract may be needed; no outreach or server changes are authorized by this investigation.

The existing transfer's current chain/operator outcome was not rechecked here. Keep its record intact and use its established read-only recovery flow. Do not reinterpret this feasibility result as cancellation, failure, loss of funds or permission to retry.
