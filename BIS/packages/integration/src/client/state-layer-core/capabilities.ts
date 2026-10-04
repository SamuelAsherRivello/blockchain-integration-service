import type { BisState } from './context.ts';
import type { BisGameWalletState } from './game-wallet.ts';

export const GAME_WALLET_MIN_ASSET_MINT_BALANCE_SATS = 1000;

/** The game-facing item capability deliberately does not inspect the Game Wallet. */
export function itemSupportAvailable(state: Pick<BisState, 'phase' | 'hasProfile'>, environment: { navigator?: { locks?: unknown } } = globalThis): boolean {
  return state.phase === 'active' && state.hasProfile && !!environment.navigator?.locks;
}

function walletsReady(state: Pick<BisState, 'phase' | 'hasProfile' | 'profileId' | 'network'>, gameWallet: Pick<BisGameWalletState, 'status' | 'profileId' | 'playerConnected' | 'network'>): boolean {
  return state.phase === 'active' && state.hasProfile && !!state.profileId &&
    gameWallet.status === 'ready' && !!gameWallet.profileId &&
    gameWallet.profileId !== state.profileId && gameWallet.playerConnected === true &&
    gameWallet.network === state.network;
}

/** Contract support means both distinct wallets are selected and usable. Balance is checked by each contract operation. */
export function contractSupportAvailable(state: Pick<BisState, 'phase' | 'hasProfile' | 'profileId' | 'network'>, gameWallet: Pick<BisGameWalletState, 'status' | 'profileId' | 'playerConnected' | 'network'>): boolean {
  return walletsReady(state, gameWallet);
}

/** Asset minting needs the contract wallet's minimum spendable balance in addition to wallet readiness. */
export function assetMintingSupportAvailable(state: Pick<BisState, 'phase' | 'hasProfile' | 'profileId' | 'network'>, gameWallet: Pick<BisGameWalletState, 'status' | 'profileId' | 'playerConnected' | 'network' | 'balance'>, environment: { navigator?: { locks?: unknown } } = globalThis): boolean {
  return itemSupportAvailable(state, environment) && walletsReady(state, gameWallet) &&
    (gameWallet.balance?.availableSats ?? 0) >= GAME_WALLET_MIN_ASSET_MINT_BALANCE_SATS;
}
