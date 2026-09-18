## Purpose

Provide one supported local browser preview origin for BIS Admin and Marketplace so their related wallet sessions and network selection can be tested together without cross-origin storage isolation.

## ADDED Requirements

### Requirement: One-origin local preview routes

The BIS workspace SHALL provide one documented Vite development command that starts exactly one local development server and serves BIS Admin beneath `/admin/` and BIS Marketplace beneath `/marketplace/` on the same scheme, host, and port. Both routes SHALL preserve their distinct application entry behavior and SHALL be directly refreshable. This local preview contract SHALL not replace the independently published Admin and Marketplace GitHub Pages routes.

#### Scenario: Developer starts the shared local preview

- **WHEN** a developer runs the documented local preview command
- **THEN** one Vite server starts and serves usable Admin at `/admin/` and Marketplace at `/marketplace/` on the same origin
- **AND** the command output identifies the one server URL without requiring a second Vite process

#### Scenario: Developer refreshes a subroute

- **WHEN** a developer directly opens or refreshes `/admin/` or `/marketplace/`
- **THEN** the corresponding application loads successfully at that route
- **AND** its static and development resources resolve without falling into the other application

### Requirement: Shared local wallet-session scope

Within the one-origin local preview, an Admin-selected BIS network and wallet session that is intentionally persisted by BIS SHALL be available to Marketplace under the same browser profile according to the existing role/session rules. Marketplace SHALL still honor its own active Player Wallet and Game Wallet roles and SHALL not promote an Admin session into the wrong wallet role or bypass authentication. Browser state from an unrelated origin SHALL not be treated as a shared local session.

#### Scenario: Admin-selected game wallet is available to Marketplace

- **WHEN** a developer selects a Game Wallet and network in Admin at `/admin/` and then opens Marketplace at `/marketplace/` without changing browser profile
- **THEN** Marketplace can resolve the corresponding persisted local session and selected network through normal BIS session behavior
- **AND** it reads Game Wallet inventory from that active session source when the Marketplace role is active

#### Scenario: Separate origin remains isolated

- **WHEN** a browser has wallet state for an Admin or Marketplace instance on another origin
- **THEN** the shared local preview does not import or present that unrelated origin's browser storage as its own session
- **AND** Marketplace requests the normal local role login when its required active role is absent
