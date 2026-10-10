# State layer core

This layer owns BIS context lifecycle, immutable public state snapshots, subscriptions, public events, browser-local state records, and cross-layer state reduction. Keep React rendering in `ui-layer-react` and direct Arkade SDK calls in `wallet-layer-arkade`.

Existing context, equipment, continuation, collection and contract controllers remain implementation building blocks and supported non-game consumer exports. Games use facade-owned named `IBis` commands and copied `BisSnapshot`/workflow projections instead of owning those controllers. Financial confirmation and `BisGameEffectReceipt` are separate outcomes: a stale or rejected gameplay effect must not retry payment or minting. Contract recovery owns durable financial progress; the facade forwards its changes through `IBisGame.onBisEvent` without game UI polling.

Read-only wallet projections use the shared bounded retry/cancellation policy. A transient provider, indexer, address, or balance failure may be retried, but only a complete validated read is published as ready; exhausted reads remain unavailable rather than becoming zero or falling back to stale data. Game Wallet observation failures may recover through a fresh read, while wallet selection, logout, network changes, and disposal cancel all pending work.
