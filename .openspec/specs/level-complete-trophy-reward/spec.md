# level-complete-trophy-reward Specification

## Purpose

Let players optionally collect self-funded level trophies while retaining completion menus, truthful wallet outcomes, and independent game progression.

**Story status:** C2. Reward Player With Trophy After Level Complete ✓ — complete, confirmed by the user on 2026-09-09. Historical verification records retain their original coverage and limitations.

## Requirements

### Requirement: Completion menus and progression
The game SHALL show Level Completed when a next packaged level exists, and Game Completed otherwise. The level body SHALL be `Great jobs. You collected {collected}/{total} gold and reached the exit.` The final body SHALL be `Great jobs. You completed {N}/{L} levels. You collected {collected}/{total} gold in the final level and reached the exit.` Gold SHALL match the current HUD formatting and total. The game SHALL offer Collect Level N Trophy, Continue To Next Level, and Restart Game in order, omitting Continue at final completion. Restart Game SHALL also label the death restart action and return to Level 1 without clearing wallet data.

#### Scenario: Intermediate and final levels
- **WHEN** a player completes a level
- **THEN** the packaged catalog selects the correct menu, level number and actions
- **AND** Continue advances to the next level while Restart begins a new run

#### Scenario: Reload and map failures
- **WHEN** the player reloads after advancing or the selected map fails to load
- **THEN** the selected level persists for this tab and load failure is not treated as game completion

#### Scenario: Playable second level
- **WHEN** the player continues from Level 1
- **THEN** Level02 loads a player, three collectible gold pickups and a reachable exit using existing assets
- **AND** reaching that exit displays the final Game Completed menu with the same gold counts as the HUD

### Requirement: Optional current-ownership reward
Hosts SHALL disable collection for guests, unknown ownership, already-owned trophies, and absent trophy configuration. Positive holdings matching the level's exact name, ticker and decimals SHALL count regardless of Admin origin or icon version. Collection SHALL remain optional and use the player's wallet funds only after an explicit click.

#### Scenario: Existing and relinquished trophies
- **WHEN** matching positive holdings exist, including restored or Admin-minted trophies
- **THEN** collection is disabled
- **AND** the existing completion body ends with `You already own this trophy.`; there is no separate status text box or `Already collected` label
- **AND** after relinquishing the trophy and completing the level again, a fresh ownership check can enable a new collection

#### Scenario: Guest or unavailable reward
- **WHEN** collection cannot be enabled
- **THEN** an explanation is shown and progression remains available without creating an account or funding automatically

### Requirement: Safe in-place collection
The completion menu SHALL remain visible and SHALL NOT dismiss through backdrop or Escape. Its actions SHALL be disabled during a bounded collection attempt. Confirmed success SHALL disable collection and show `Level N Trophy collected!` with the returned trophy image using D1. Definitive failures SHALL require acknowledgment without leaving the menu. Uncertain results SHALL retain the original request, disable new issuance, offer explicit status reconciliation, and restore navigation. Account changes and disposal SHALL suppress stale presentation.

#### Scenario: Successful collection
- **WHEN** explicit collection returns a confirmed minted or reconciled result for the active account
- **THEN** the image toast appears once, collection is disabled, and the same completion menu remains open with navigation restored

#### Scenario: Interrupted, repeated or failed collection
- **WHEN** a submission is uncertain, repeated, or fails
- **THEN** no fabricated success or automatic new issuance occurs
- **AND** retries reconcile the same operation and navigation remains available after the bounded attempt

#### Scenario: Account replacement
- **WHEN** the active account changes during ownership checking or collection
- **THEN** the previous account's result cannot enable collection or show success for the new account
