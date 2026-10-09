# Game wallet layer

This layer is reserved for browser-local game wallet selection, restoration, payment eligibility, and game-wallet-specific coordination. Keep player account state and Arkade SDK details in the state and Arkade wallet layers unless a boundary adapter is needed here.

The game-facing `IBis` facade owns its game wallet privately. `BisWalletReference` exposes only profile identity and network; it is not an application or gameplay-session identity. Capability snapshots report readiness separately for Player-only equipment and Player-plus-Game payment/mint/contract flows. Games must not load signer storage, refresh a raw wallet controller, or substitute another wallet when readiness is unavailable.
