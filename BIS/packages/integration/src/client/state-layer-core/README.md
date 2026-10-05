# State layer core

This layer owns BIS context lifecycle, immutable public state snapshots, subscriptions, public events, browser-local state records, and cross-layer state reduction. Keep React rendering in `ui-layer-react` and direct Arkade SDK calls in `wallet-layer-arkade`.
