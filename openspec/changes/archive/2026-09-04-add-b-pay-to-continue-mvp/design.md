## Context

See proposal.md for motivation. This design delivers B1 only, including all of its error and pending-operation semantics. B2 game integration, B3 optional review/guidance UI and B4 extended recovery UI are separate future stories. Existing adapters create per-identity SDK wallets with transient repositories; Core owns persistent account/operation state. Admin already demonstrates public asset APIs through Console. The installed SDK is 0.4.67. Existing asset burn code is not evidence of native Bitcoin burning support. The subsequent user decision authorizes the generated-recipient sink fallback and validation. No successful live operation has yet been recorded.

## Goals / Non-Goals

**Goals:** A thin host API with one initiating call, stable request identity, public status, and an Admin-only demonstration. Preserve the current account and wallet-operation reservation rules.

**Non-Goals:** Recipient wallet management, a backend server, death/checkpoint rendering, revival implementation, signed entitlements, consume calls, ads, USD pricing, automatic refunds, or automatic funding.

## Decisions

1. FEASIBILITY.md establishes no supported native-sat burn. The user explicitly selected a newly generated test recipient fallback. Create it transiently, obtain its public Arkade address, and never save or activate it. Discard references to its secret after address acquisition. Results say sink-payment, not Bitcoin destruction. D1 wallet management remains deferred.
2. Proposed public shape: requestContinue with operationId, sats, and an opaque continuation context supplied by the host. Use plain domain types, not SDK types. Public status lookup/subscription supports pending recovery; it is not a consume operation. A final method signature can follow existing public API conventions without changing these semantics.
3. Core validates integer bounds before adapter invocation, records the account and request payload before submission, and coordinates existing wallet reservations. The adapter owns verified SDK payment and reconciliation. Reject reuse of the identity with changed inputs. Return the existing result on identical retry. Host processes a successful operation only once and checks its current run context; BIS never owns gameplay.
4. Persist non-secret operation identity and reconciliation evidence through reload before exposing submission. Do not reuse generic failure for unknown outcomes. Integrate logout/reset protection so unresolved payments cannot lose their recovery record. Avoid unrelated global wallet blocking; reserve only what the existing operation framework requires.
5. Admin presents the price beside Request Continue and defaults to 1,000 sats. No amount editor is needed for this first demonstration; API tests cover the full range. Disable repeated submission while unresolved, write public outcomes to Console, and leave preview untouched. No second confirmation overlay is added.
6. Keep an explicit code comment at validation: the 1,000–10,000 limit is client-side input validation, not fail-safe price enforcement. Configuring a server-free game cannot prevent a modified client bypassing continuation logic.

## Risks / Trade-offs

- Native-sat burning was not established; the authorized generated-recipient fallback reports a sink payment, with no destruction claim.
- Fees could exceed the advertised debit → establish fee semantics before enabling the gesture; show any additional verified fee before submission. Stop for a decision if this cannot fit the one-gesture contract.
- Duplicate submission or late response → durable identity and reconciliation; host context checks and deduplication.
- Browser storage loss remains possible → do not promise recovery after deliberate storage removal; preserve existing recovery guards.
- All-local enforcement can be modified → document the accepted demo limitation without claiming trusted authorization.

## Migration Plan

Add a separate operation record namespace without destructive migrations. Add API and Admin exposure only after feasibility passes. If exposure must be withdrawn, retain pending records and reconciliation ability. Do not reset accounts or clear existing wallet state. Sync updated B documentation with the actual delivered slice; the broader B journeys remain deferred.

## Authorized fallback contract

- The single gesture pays exactly the requested sats with zero additional fee. Existing send planning rejects any nonzero or changed operator fee schedule and subdust change; there is no silent donation of change. Default debit is exactly 1,000 Signet sats.
- Reuse exact prepared-input/output checks, SDK completion, and indexer reconciliation matching transaction ID, output index, script and value. Balance subtraction is supplementary and never the success criterion. Missing outputs/timeouts remain pending.
- Store the send evidence atomically inside a separate per-account continuation journal before network submission. Generic Send cannot overwrite it. A prepared attempt without a send marker is provably not submitted once the exclusive wallet lock is reacquired; report failed without retrying it.
- Retain continuation journals through normal logout/reset. Pending or unreadable continuation records block clearing and spending; completed request IDs remain idempotent after account restoration.


### Asset-bearing input repair

Live diagnosis established that the SDK considers all 289,715 sats spendable, but BIS's additional asset-free filter excluded the single output carrying three assets. B1 now opts into SDK-eligible asset-bearing inputs and retains all assets in player-owned change. The generic Send path retains its prior selection policy. Expected asset extension bytes are derived from exact input asset IDs/quantities and change output index 1; strict verification rejects any different extension or extra outputs. Quotes bind the asset inventory. The durable send journal stores the expected public asset-change manifest, and reconciliation requires both the asset-free recipient and exact asset-bearing change. Insufficient change prevents submission. Historical failed operation IDs remain failed and are never resubmitted; a new deliberate attempt is required after the fix.
