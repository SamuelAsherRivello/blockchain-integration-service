# Recovery capability evidence

Reviewed 2026-09-08. This analysis distinguishes source behavior at a known revision from the deployed Signet service, whose public version field is blank. It does not authorize a signing query or cancellation.

## Source examined

arkd PR #917 head revision: `f48445b8fc018211a593a555ea5cf4a23a49a07f`. Public GitHub API file patches and raw sources were read directly during apply:

- [Application service](https://github.com/arkade-os/arkd/blob/f48445b8fc018211a593a555ea5cf4a23a49a07f/internal/core/application/service.go): lookup at lines 4086–4122, ownership verification and cache matching at 4135–4310, deletion at 2192–2216, selection at 2515 onward.
- [RPC transport](https://github.com/arkade-os/arkd/blob/f48445b8fc018211a593a555ea5cf4a23a49a07f/api-spec/protobuf/ark/v1/service.proto) and [handler](https://github.com/arkade-os/arkd/blob/f48445b8fc018211a593a555ea5cf4a23a49a07f/internal/interface/grpc/handlers/arkservice.go).
- [Ownership message](https://github.com/arkade-os/arkd/blob/f48445b8fc018211a593a555ea5cf4a23a49a07f/pkg/ark-lib/intent/message.go).
- [In-memory queue](https://github.com/arkade-os/arkd/blob/f48445b8fc018211a593a555ea5cf4a23a49a07f/internal/infrastructure/live-store/inmemory/intents.go): selection 102–136, deletion 185–200, lookup 223 onward.
- [Redis queue](https://github.com/arkade-os/arkd/blob/f48445b8fc018211a593a555ea5cf4a23a49a07f/internal/infrastructure/live-store/redis/intents.go): selection 125 onward, lookup 195 onward, deletion 271–292.

## Capability matrix

| Capability | Verified source behavior | Installed SDK / deployed verification | Decision |
| --- | --- | --- | --- |
| Query proof | `get-intent` message with expiry; input ownership proof validation checks the input scripts, amounts and signatures | SDK 0.4.67 has no exposed provider query method; no live proof signed | Delivery blocked at supported SDK boundary |
| Transport | GET `/v1/intent` retained; POST `/v1/intent` with request body added; request selects txid or intent proof | Deployed revision is unknown; no signed probe | Do not assume deployed support |
| Ownership lookup visibility | Searches the current intent cache for any input overlapping the proof's outpoints | Source verified; deployed result not verified | Absence cannot prove terminal outcome |
| Lookup multiplicity | Returns all overlapping cached intents, deduplicated by ID internally | Reply contains repeated proof/message pairs; singular legacy reply is for txid lookup | A proof can cover several independent cached intents; process every match |
| Lookup status evidence | Ownership reply contains intent proof and message, without terminal outcome or batch status | No stronger SDK surface found | Cannot release inputs based on reply or absence |
| Txid lookup | Reads the round repository, separate from ownership/cache lookup | Requires the intent proof transaction ID, which is not the registered UUID or necessarily retained by BIS | Do not substitute an operation UUID or assume it is terminal history |
| Deletion scope | Deletes every cached intent matched by overlapping owned inputs | SDK exposes proof-based `deleteIntent`, returning void | No demonstrated exact-intent-only guarantee |
| Deletion finality | Cache deletion is separate from selection; a selected intent can survive a successful deletion call | Source counterexample below; deployed revision/cache implementation unknown | Empty acknowledgement is insufficient |

## Concrete selection/deletion counterexample

The in-memory implementation demonstrates this legal interleaving without any network assumption:

1. Ownership lookup reads an intent from the cache and returns its ID to the deletion service.
2. Batch selection takes the queue lock, copies the intent into the selected batch, removes it from the pending map, and releases the lock.
3. Deletion takes the lock afterward. The ID is absent from the pending map, so deletion skips it and returns success.
4. The selected batch still owns its copied intent. Deletion did not revoke its selection or signing session.

Each individual cache operation is locked, but the service's lookup-and-delete sequence has no shared atomic guard with selection. The Redis deletion implementation also skips a missing cached entry and returns success; it does not remove a selected batch. This is a source-level counterexample, not an executed test of either Go implementation or the deployed operator. Go is not installed in this environment, and no Go toolchain/dependencies were installed as part of this inspection.

Consequently, a trustworthy terminal cancellation path needs an operator-supported result bound to the original intent that excludes current or later settlement, with scope and race behavior verified for the deployed version. Neither the existing empty deletion response nor ownership-query absence supplies that guarantee. Automatic cancellation, clearing journals and replay remain disallowed.

Tasks 3.1 and 3.2 remain open for their controlled/deployed verification requirements; 3.3 and 3.4 remain blocked on the specified SDK/finality capabilities. This document supplies precise evidence rather than treating an unavailable branch as completed implementation.
