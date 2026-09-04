# Achievement trophy assets

The `v1/level-1-trophy.png`, `v1/level-2-trophy.png`, and `v1/level-3-trophy.png` files are 64 by 64 transparent PNGs for Achievement: Level 1 (LVL1), Level 2 (LVL2), and Level 3 (LVL3).

The icons match the Stealth Grid pixel-art style and preserve the same trophy artwork outside the number area. Each cup carries only its matching digit, with no other text.

| Preset | Ticker | Public icon |
| --- | --- | --- |
| Achievement: Level 1 | LVL1 | [Level 1 trophy](https://samuelasherrivello.github.io/blockchain-integration-service/assets/achievements/v1/level-1-trophy.png) |
| Achievement: Level 2 | LVL2 | [Level 2 trophy](https://samuelasherrivello.github.io/blockchain-integration-service/assets/achievements/v1/level-2-trophy.png) |
| Achievement: Level 3 | LVL3 | [Level 3 trophy](https://samuelasherrivello.github.io/blockchain-integration-service/assets/achievements/v1/level-3-trophy.png) |

Quick fill uses these absolute URLs in local development and on the live site, with amount 1 and decimals 0. Fields remain editable; selecting a preset does not mint. The initial form still has a blank optional Icon URL. BIS stores the URL as metadata and does not fetch it when listing assets.

Published in [trophy-assets-v1](https://github.com/SamuelAsherRivello/blockchain-integration-service/releases/tag/trophy-assets-v1), with all three PNGs also attached to the release. Deployment and browser evidence are recorded in [C1/C4 verification](../../../../../.openspec/changes/add-achievement-opportunities-and-collection/C1_C4_VERIFICATION.md#numbered-trophy-assets-and-preset-urls--2026-09-04).

Keep these files at their original paths and preserve their contents: minted metadata can reference them indefinitely. Publish revised artwork in a new version directory. Availability depends on retaining this repository and its GitHub Pages deployment.
