# Public address observer

`wallet-events.ts` uses SDK 0.4.79 script subscriptions directly. No mnemonic, wallet identity, or persistent wallet repository is created. Network/operator validation runs before observation. Only outputs whose script matches the captured public address are described.

The indexer supplies new, spent, and swept VTXOs. Asset amounts remain bigint values until presentation. A spend is labeled as an output change, not an inferred outgoing payment. Bitcoin boarding events, global settlement batches, and other HD addresses are outside this exact-script observation.

The first complete snapshot establishes history. The stream starts buffering before the follow-up snapshot, which reconciles changes without erasing buffered arrivals. Transition keys distinguish receipt, spend, and sweep of the same outpoint. They remain in memory across connection retries. Reopening creates a new baseline. Transitions completed entirely during an unobserved gap cannot be guaranteed.

SDK EventSource open/error events drive connection state. Setup has a 75-second deadline to allow the operator's initial heartbeat; failed attempts release the stream and retry with delays capped at five seconds. Closure aborts the iterator, clears timers, and requests server unsubscribe. Abrupt browser termination may prevent that asynchronous request from completing.

Tests inject providers only through the module API. The production popup has no test-event endpoint. Funded browser acceptance must use independent live indexer responses and public transaction references; deterministic tests alone do not establish delivery on either network.

The front cycles status dots every second while visible. Only the newest activity is shown for five seconds; replacement cancels the previous timer and pulse. Clicking the 7px-rounded card, or pressing Enter/Space, flips it around the Y axis to a viewport-height scrollable log. Connection changes and observed activity are appended chronologically in memory. Dot ticks and duplicate status callbacks do not create log entries. The log is not historical blockchain discovery and is not persisted across reloads. Reduced motion removes the flip transition and pulses while preserving state and log access.
