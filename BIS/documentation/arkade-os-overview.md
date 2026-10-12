# Arkade OS — Overview

[Back to the main README](../../README.md#-documentation)

[Arkade OS](https://arkadeos.com/) is an open, programmable extension of Bitcoin for wallets, payments, assets, and contracts—not a separate blockchain. BIS wraps its [TypeScript SDK](https://docs.arkadeos.com/) so games can use shared wallet services and Account UI.

## Game wallet operations

The Stealth & Steel integration uses BIS for these wallet workflows; this is not a list of operations performed during every game session:

- Create or restore the Player Wallet and display receiving addresses.
- Read the player's Bitcoin balance.
- Discover wallet-owned game assets and read their item metadata.
- Support player payments and transfers through the shared wallet UI.
- Reuse an optional Game Wallet for game-side activity, with transaction readiness and reconciliation safeguards.

Each app session retains one Player Wallet and, when needed, one Game Wallet. Fresh balance and ownership reads reuse those wallets; retaining a wallet does not mean returning an old balance.

## API response times

Measured **2026-10-12**, with **BIS 0.0.22** and **Arkade SDK 0.4.72**. “BIS Admin” below means this repository's Admin preview Account dialog—not Marketplace or the standalone onboarding prototype. “Stealth & Steel” means the separate game consuming the verified BIS package.

All times are milliseconds: **median (p50) / p95**. Each feature has ten successful explicit refreshes; “below 1 second” counts reads strictly below 1000 ms. With ten samples, nearest-rank p95 is the slowest sample.

| Application | Network | Get Balance p50 / p95 (ms) | Get Balance below 1 second | List Assets p50 / p95 (ms) | List Assets below 1 second |
| --- | --- | ---: | ---: | ---: | ---: |
| Stealth & Steel game | Signet | 166.7 / 245.0 | 10/10 | 123.6 / 150.4 | 10/10 |
| BIS Admin demo | Signet | 192.9 / 267.1 | 10/10 | 143.2 / 152.7 | 10/10 |
| Stealth & Steel game | Mutinynet | 1240.0 / 1913.1 | 0/10 | 1309.4 / 1752.9 | 0/10 |
| BIS Admin demo | Mutinynet | 1228.7 / 1572.8 | 0/10 | 1223.4 / 1734.7 | 0/10 |

**Both applications were consistently sub-one-second on Signet in this sample, but neither was on Mutinynet.** This is an observation, not a network performance guarantee.

“Owned assets” means fresh wallet ownership discovery plus the metadata needed to show the inventory. It does **not** measure downloading images, audio, videos, or other media files. Warm metadata can be reused; ownership is freshly read. Signet's fixture had no assets, so its results do not establish populated-inventory performance. Mutinynet's fixture had four assets; both applications used the same fixture on each network.

### Standalone prototype comparison

A read-only comparator reproduced the onboarding prototype's SDK sequence; the automatic onboarding UI itself was not run because it can transact. These measurements are separate from BIS Admin:

| Application | Network | Get Balance p50 / p95 (ms) | List Assets p50 / p95 (ms) | Get Balance + List Assets p50 / p95 (ms) |
| --- | --- | --- | --- | --- |
| Onboarding SDK comparator | Signet, no assets | 89.6 / 308.4; 10/10 below 1 second | 0 / 0; no assets to fetch | 89.6 / 308.4; 10/10 below 1 second |
| Onboarding SDK comparator | Mutinynet, four assets | 752.9 / 1328.4; 8/10 below 1 second | 513.4 / 586.3; 10/10 below 1 second | 1275.2 / 1843.0; 0/10 below 1 second |

Metadata-only timing excludes ownership discovery. The SDK comparator's normal incremental wallet repository behavior is not equivalent to BIS's complete ownership reads. The full prototype-equivalent Mutinynet sequence was also not consistently sub-one-second.

## Measurement boundaries and provenance

UI timings cover Refresh activation through the completed loading state, excluding startup and wallet restoration. Refresh bypasses completed display caches but may share compatible in-flight work. Samples were collected serially in isolated browser contexts, not under controlled provider load. No funding, signing, or transactions were performed.

Observed Mutinynet ownership fetches averaged approximately 1.2–1.4 seconds across game and Admin, versus about 0.16–0.18 seconds for explorer fetches. This points to upstream ownership reads as the dominant delay in this run, rather than game-only overhead.

- [Verified BIS source](https://github.com/SamuelAsherRivello/blockchain-integration-service/commit/efcfb022b8efa5cfa4d51d298ad003c67ce06134).
- [Measured game revision](https://github.com/SamuelAsherRivello/blockchain-stealth-and-steel-game/commit/2faa241a6a492d42a4ec9110becb801303fb3bb4).
- BIS package SHA-256: `3b12ed2b26a9248579e9574d4bb8775b4bb08b643313171723448c53e7463528`; all 145 installed package files passed verification.
