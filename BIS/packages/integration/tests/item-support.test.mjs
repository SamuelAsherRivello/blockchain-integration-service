import test from 'node:test';
import assert from 'node:assert/strict';
import { assetMintingSupportAvailable, contractSupportAvailable, GAME_WALLET_MIN_ASSET_MINT_BALANCE_SATS, itemSupportAvailable } from '../src/core/capabilities.ts';

const active = { phase: 'active', hasProfile: true };
const supportedEnvironment = { navigator: { locks: {} } };

test('item support requires an active Player Wallet and supported item environment', () => {
  assert.equal(itemSupportAvailable(active, supportedEnvironment), true);
  assert.equal(itemSupportAvailable({ phase: 'idle', hasProfile: true }, supportedEnvironment), false);
  assert.equal(itemSupportAvailable({ phase: 'active', hasProfile: false }, supportedEnvironment), false);
  assert.equal(itemSupportAvailable(active, { navigator: {} }), false);
});

test('item support does not inspect or require a Game Wallet', () => {
  const state = { ...active, gameWallet: undefined, gameWalletBalance: 0 };
  assert.equal(itemSupportAvailable(state, supportedEnvironment), true);
  assert.equal(itemSupportAvailable({ ...state, gameWallet: 'logged-out' }, supportedEnvironment), true);
});

const readyGameWallet = (balance = GAME_WALLET_MIN_ASSET_MINT_BALANCE_SATS) => ({
  status: 'ready', profileId: 'game', playerConnected: true, network: 'signet',
  balance: { availableSats: balance },
});
const activeNetwork = { ...active, profileId: 'player', network: 'signet' };

test('asset minting support requires both wallets and the minimum Game Wallet balance', () => {
  assert.equal(assetMintingSupportAvailable(activeNetwork, readyGameWallet()), true);
  assert.equal(assetMintingSupportAvailable(activeNetwork, readyGameWallet(GAME_WALLET_MIN_ASSET_MINT_BALANCE_SATS - 1)), false);
  assert.equal(assetMintingSupportAvailable(activeNetwork, { ...readyGameWallet(), profileId: 'player' }), false);
  assert.equal(assetMintingSupportAvailable(activeNetwork, { ...readyGameWallet(), network: 'mutinynet' }), false);
  assert.equal(assetMintingSupportAvailable(activeNetwork, { ...readyGameWallet(), status: 'empty' }), false);
});

test('contract support requires distinct ready wallets but does not require a balance', () => {
  assert.equal(contractSupportAvailable(activeNetwork, readyGameWallet(0)), true);
  assert.equal(contractSupportAvailable(activeNetwork, { ...readyGameWallet(), profileId: 'player' }), false);
  assert.equal(contractSupportAvailable(activeNetwork, { ...readyGameWallet(), status: 'loading' }), false);
  assert.equal(contractSupportAvailable(activeNetwork, { ...readyGameWallet(), network: 'mutinynet' }), false);
});
