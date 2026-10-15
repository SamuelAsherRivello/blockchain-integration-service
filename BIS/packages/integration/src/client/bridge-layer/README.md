# Bridge layer

This layer is reserved for browser-side adapters that connect host applications to BIS client state, UI mounting, and public coordination points. Keep wallet SDK work, durable operation storage, and React component rendering in their owning layers.

Games implement the five-method public `IBisGame` contract and consume `IBis` through `BisService`. The host supplies the active gameplay session, captures continuation targets, applies confirmed continuation/reward effects, and receives `onBisEvent` notifications. Route Account dismissal, restart, snapshot and operation updates through that channel; do not inspect BIS DOM or register parallel context listeners. The concrete game adapter belongs to the game, not this reserved layer. See the [compiled public example](../../../tests/fixtures/game-contract-types.ts).
