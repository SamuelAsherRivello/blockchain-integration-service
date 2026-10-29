import assert from 'node:assert/strict';
import test from 'node:test';
import { marketplaceWalletGuidance } from '../../src/client/marketplace-layer/wallet-guidance.ts';

test('hosted Game Wallet guidance does not require Game Wallet Login', () => {
  const guidance = marketplaceWalletGuidance({
    hostedGameWallet: true,
    gameListingEnabled: false,
    salesEnabled: false,
  });

  assert.match(guidance.description, /separate Game Wallet Login is not required/);
  assert.match(guidance.listing, /connect the Player Wallet/);
  assert.match(guidance.sales, /connect the Player Wallet/);
  assert.doesNotMatch(`${guidance.description} ${guidance.listing} ${guidance.sales}`, /log in to .*Game Wallet/i);
});

test('manual Game Wallet guidance retains the existing separate-login fallback', () => {
  const guidance = marketplaceWalletGuidance({
    hostedGameWallet: false,
    gameListingEnabled: false,
    salesEnabled: false,
  });

  assert.match(guidance.description, /manual wallet flow, log in to a separate Game Wallet/);
  assert.match(guidance.listing, /log in to a Player Wallet and a separate Game Wallet/);
  assert.match(guidance.sales, /log in to separate Player and Game Wallets/);
});

test('enabled hosted Game Wallet actions describe the server-owned wallet accurately', () => {
  const guidance = marketplaceWalletGuidance({
    hostedGameWallet: true,
    gameListingEnabled: true,
    salesEnabled: true,
  });

  assert.match(guidance.listing, /server Game Wallet is connected/);
  assert.match(guidance.sales, /server Game Wallets are available/);
});
