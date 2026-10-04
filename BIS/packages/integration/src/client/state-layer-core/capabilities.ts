import type { BisState } from './context.ts';
import type { BisGameWalletState } from './game-wallet.ts';

export const GAME_WALLET_MIN_ASSET_MINT_BALANCE_SATS = 1000;

type CapabilityEnvironment = { navigator?: { locks?: unknown } };
type PlayerWalletCapabilityState = Pick<BisState, 'phase' | 'hasProfile' | 'profileId' | 'network'>;
type GameWalletCapabilityState = Pick<BisGameWalletState, 'status' | 'profileId' | 'playerConnected' | 'network' | 'balance' | 'message'>;

/** The game-facing item capability deliberately does not inspect the Game Wallet. */
export function itemSupportAvailable(state: Pick<BisState, 'phase' | 'hasProfile'>, environment: CapabilityEnvironment = globalThis): boolean {
  return state.phase === 'active' && state.hasProfile && !!environment.navigator?.locks;
}

function walletsReady(state: PlayerWalletCapabilityState, gameWallet: GameWalletCapabilityState): boolean {
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
export function assetMintingSupportAvailable(state: Pick<BisState, 'phase' | 'hasProfile' | 'profileId' | 'network'>, gameWallet: Pick<BisGameWalletState, 'status' | 'profileId' | 'playerConnected' | 'network' | 'balance'>, environment: CapabilityEnvironment = globalThis): boolean {
  return itemSupportAvailable(state, environment) && walletsReady(state, gameWallet) &&
    (gameWallet.balance?.availableSats ?? 0) >= GAME_WALLET_MIN_ASSET_MINT_BALANCE_SATS;
}

function playerWalletReasons(state: PlayerWalletCapabilityState): string[] {
  const reasons: string[] = [];
  if (state.phase !== 'active' || !state.hasProfile || !state.profileId) reasons.push('sign in to an active Player Wallet');
  return reasons;
}

function gameWalletReasons(state: PlayerWalletCapabilityState, gameWallet: GameWalletCapabilityState): string[] {
  const reasons: string[] = [];
  if (gameWallet.status === 'loading') reasons.push('wait for the Game Wallet to finish loading');
  else if (gameWallet.status === 'empty') reasons.push('select or create a Game Wallet');
  else if (gameWallet.status === 'unavailable') reasons.push(gameWallet.message ?? 'restore a usable Game Wallet');
  else if (gameWallet.status !== 'ready') reasons.push('select a ready Game Wallet');
  if (!gameWallet.profileId && gameWallet.status === 'ready') reasons.push('select a Game Wallet');
  if (state.profileId && gameWallet.profileId === state.profileId) reasons.push('select a Game Wallet different from the Player Wallet');
  if (gameWallet.playerConnected !== true) reasons.push('reconnect the Game Wallet to the Player Wallet');
  if (state.network && gameWallet.network && gameWallet.network !== state.network) reasons.push(`select a Game Wallet on ${state.network === 'signet' ? 'Signet' : 'Mutinynet'}`);
  return reasons;
}

function sentence(prefix: string, reasons: string[]): string {
  return `${prefix}: ${reasons.join('; ')}.`;
}

/** Gives the Developer panel an exact explanation for a currently unavailable capability. */
export function itemSupportFeedback(state: Pick<BisState, 'phase' | 'hasProfile' | 'profileId'>, environment: CapabilityEnvironment = globalThis): string {
  if (itemSupportAvailable(state, environment)) return 'Current status: available. The Player Wallet is active and this browser supports item operations.';
  const reasons: string[] = [];
  if (state.phase !== 'active' || !state.hasProfile) reasons.push('sign in to an active Player Wallet');
  if (!environment.navigator?.locks) reasons.push('use a browser with Web Locks support');
  return sentence('Items are unavailable', reasons);
}

/** Gives the Developer panel an exact explanation for a currently unavailable capability. */
export function contractSupportFeedback(state: PlayerWalletCapabilityState, gameWallet: GameWalletCapabilityState): string {
  if (contractSupportAvailable(state, gameWallet)) return 'Current status: available. Distinct Player and Game Wallets are ready on the same network.';
  return sentence('Contracts are unavailable', [...playerWalletReasons(state), ...gameWalletReasons(state, gameWallet)]);
}

/** Gives the Developer panel an exact explanation for a currently unavailable capability. */
export function assetMintingSupportFeedback(state: PlayerWalletCapabilityState, gameWallet: GameWalletCapabilityState, environment: CapabilityEnvironment = globalThis): string {
  if (assetMintingSupportAvailable(state, gameWallet, environment)) return `Current status: available. The Game Wallet has at least ${GAME_WALLET_MIN_ASSET_MINT_BALANCE_SATS.toLocaleString()} sats available for minting.`;
  const reasons = [...playerWalletReasons(state), ...gameWalletReasons(state, gameWallet)];
  if (!environment.navigator?.locks) reasons.push('use a browser with Web Locks support');
  const availableSats = gameWallet.balance?.availableSats;
  if (availableSats === undefined) reasons.push('load the Game Wallet balance');
  else if (availableSats < GAME_WALLET_MIN_ASSET_MINT_BALANCE_SATS) reasons.push(`fund the Game Wallet with ${GAME_WALLET_MIN_ASSET_MINT_BALANCE_SATS.toLocaleString()} sats (currently ${availableSats.toLocaleString()} sats; ${Math.max(0, GAME_WALLET_MIN_ASSET_MINT_BALANCE_SATS - availableSats).toLocaleString()} more needed)`);
  return sentence('Asset Minting is unavailable', reasons);
}
