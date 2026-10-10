# React UI layer

This layer owns private React components, CSS, UI-only hooks, copy controls, dialogs, toast presentation, and production overlay mounting. Do not put wallet submission, durable operation journals, or SDK-specific state ownership here.

Games import the supported `@bis/integration/style.css` entry and call `IBis.mount`, `openAccountDialog`, `showLoadingUI` and `hideLoadingUI`; `isLoadingUIVisible` is the presentation visibility query. Keep `data-bis-*` attributes and component selectors private. Gameplay observes `BisSnapshot` and `IBisGame.onBisEvent`, including `accountClosed`, rather than DOM mutations. Admin and Marketplace may retain their supported public `createBisUi` composition; that non-game API does not expose private React components.
