# Tasks

## 1. Shared read ownership and cache eligibility

- [x] 1.1 Add the context-owned read coordinator around the completed cache with normalized query keys, account generation, dependency revisions, pending records installed before loader invocation, and matching-record cleanup; verify deferred-promise tests prove simultaneous consumers cause exactly one provider invocation and an old completion cannot remove its replacement.
- [x] 1.2 Separate presentation subscriptions from request ownership and implement cancellation/invalidation for logout, reset, disposal, account/network replacement, and relevant evidence; verify leaving/rejoining a page preserves valid work while a provider resolving after abort cannot cache or publish obsolete data.
- [x] 1.3 Centralize bounded attempts and distinguish entry, explicit Refresh, and authoritative operation paths; verify a foreground join during the second attempt retains elapsed time and creates no third automatic attempt, Refresh bypasses completed values but joins eligible live work, and invalidated work is superseded.
- [x] 1.4 Preserve five-minute complete-result caching and source timestamps, including complete empty collections and partial-result exclusion; verify fake-clock tests cover TTL expiry, independent dependency invalidation, and joins/composition that cannot extend freshness.
- [x] 1.5 Document coordinator ownership, key compatibility, detach/abort semantics, retry ownership, and cache versus authoritative operation modes in its internal API documentation; verify each documented rule is exercised by the coordinator tests and no SDK types or secrets enter public payloads.

## 2. Balance and address consumers

- [x] 2.1 Extract balance/address presentation preparation from the visible-page guard into shared dependency reads and compose complete Details snapshots with dependency revisions and the oldest successful timestamp; verify deferred reads cover balance-first success, address failure, partial Details exclusion, account/network isolation, and unchanged adapter validation.
- [x] 2.2 Replace automatic entry calls that currently invalidate via `refreshBalance()` with immediate entry consumption for Details, Receive, Send, and Swap; verify one pending balance and one pending address read serve the compatible pages and each page waits only for its required fields.
- [x] 2.3 Replace Send's nested initial retry/subscription waiting with shared bounded readiness while preserving live Send and Swap review/quote/confirmation paths; verify navigation during warming does not lose completion or restart the read and live operation tests still validate authoritative state.
- [x] 2.4 Connect pending shared reads to existing loading policies and refresh affordances; verify browser fixtures show construction-gated modal loading for joined Receive/Send/Swap reads, non-modal Details dashes and spinning Refresh while pending, and no Details spinner for a complete warm snapshot.
- [x] 2.5 Update the integration package README's cache/loading explanation for shared balance/address preparation and explicit Refresh eligibility; verify its named filename, relative repository link, length target, and described behavior remain correct.

## 3. Shared history readiness and invalidation

- [x] 3.1 Expose timestamped first-snapshot readiness internally from the existing shared wallet observer without awaiting its observation lifetime; verify one compatible source serves payment notifications, warm-up, and Transactions, while injected separate-source compositions retain a bounded fallback.
- [x] 3.2 Route Transactions entry and Refresh through shared readiness and the existing local send/mint/boarding journal merge; verify full history, exact signed asset quantities, empty/unavailable distinctions, 75-second attempt budgets, and existing polling fallback with the focused activity and subscription suites.
- [x] 3.3 Detach Transactions presentation on exit without stopping the account-owned source, and classify repeated identical observations separately from changed evidence; verify leave/reenter request counts, cleared selections, current snapshot reuse, and identical emissions that neither restart pending balance reads nor extend cached timestamps.
- [x] 3.4 Document account-source versus page-subscription ownership and evidence invalidation in the relevant internal observer/read documentation and existing cache explanation; verify the documentation matches the new lifecycle tests and no additional always-on history source is introduced.

## 4. Assets and passive Contracts integration

- [x] 4.1 Move raw ownership preparation behind the shared coordinator while retaining Assets' visible-only output subscription and public listing behavior; verify one pending compatible read can serve an inventory consumer and Assets entry, exit/reentry reuses it, event refresh stays non-modal, and no new ownership polling appears.
- [x] 4.2 Keep authoritative ownership checks distinct from presentation reuse in equipment selection, burn, mint, and delivery paths; verify equipment/action regression tests still require fresh ownership and passive listing never navigates or changes runtime presentation on its own.
- [x] 4.3 Route passive contract preparation through normalized filter-specific sharing and current account/evidence guards; verify reordered equivalent filters deduplicate, narrower filters cannot satisfy the complete Account list, terminal and other-network records remain included where requested, and expiry display does not rely on a stale eligibility flag.
- [x] 4.4 Preserve the passive-query boundary established by `defer-lto-reconciliation-and-toast-noise`; verify startup and Contracts navigation fixtures never invoke reconciliation, submission, refund, or operation-toast replay, while explicit status/actions retain their existing live behavior.
- [x] 4.5 Document conditional raw-assets reuse and passive Contracts coverage in the relevant cache/consumer documentation; verify Marketplace inventory ownership, Game Wallet behavior, and existing public listing contracts are described without promising cross-context sharing.

## 5. Finite startup scheduler

- [x] 5.1 Start warm-up after verified active account hydration/creation/restoration/selection and an initial render opportunity, independently of `readyAsync()`; verify guest, missing-network, incomplete-account, and disposal fixtures start no speculative read and a deferred warmer cannot delay mounting or account readiness.
- [x] 5.2 Add the single-slot speculative order of Details dependencies, missing Transactions readiness, missing passive Contracts, and demand-eligible Assets, with observer/result reuse and cancellable idle scheduling; verify deterministic scheduler tests cover ordering, one-slot concurrency, existing-source adoption, successful-empty jobs, failure continuation, and no TTL-only refill.
- [x] 5.3 Promote queued or pending consumer work immediately on navigation, pause new speculative provider jobs during foreground preparation and explicit wallet operations, and resume eligible jobs afterward; verify foreground request counts, normal loading UI, retained deadlines, and no cancellation caused solely by promotion.
- [x] 5.4 Derive Assets eligibility from existing ownership demand or current-session Assets interest, keep background-only errors silent, and clear scheduled work/interest on lifecycle replacement; verify generic item capability alone does not read inventory, background failures create no dialog/toast/account error, and no navigation-history or wallet-snapshot persistence is added.
- [x] 5.5 Update the integration README and relevant existing overview documentation with the warm-up order, demand rules, finite lifetime, foreground adoption, and explicit-only operations; verify links and the package README length target and ensure the view inventory in this design remains consistent with implemented policy.

## 6. Integration acceptance

- [x] 6.1 Run the focused coordinator, scheduler, cache, balance, Send/Swap, activity/subscription, Assets, Contracts, and loading browser suites; verify navigation during deferred warm-up produces the expected loading state and exactly one compatible provider request, including failure, Refresh, rapid reentry, and late-result cases.
- [x] 6.2 Run `npm run typecheck`, `npm run build`, and `npm test`; verify integration, Admin, and Marketplace compatibility and record any unrelated existing or environment failures separately under repository-root `output/reports/background-caching/` and in this change's verification note, without claiming live network acceptance from fixtures.
- [x] 6.3 Validate the completed change against these specs and run `openspec validate background-caching --strict`; verify all acceptance cases have evidence, any required live Signet/Mutinynet checks are identified explicitly rather than inferred, and only completed implementation tasks are marked done.

