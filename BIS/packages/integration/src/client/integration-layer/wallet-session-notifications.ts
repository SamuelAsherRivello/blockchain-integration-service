import type { TestNetwork } from '../state-layer-core/test-network.ts';

export const WALLET_SESSION_NOTIFICATION_VERSION = 1 as const;
export type WalletSessionRole = 'player' | 'game';
export type WalletSessionNotification = Readonly<{
  type: 'bis.wallet-session';
  version: typeof WALLET_SESSION_NOTIFICATION_VERSION;
  role: WalletSessionRole;
  active: boolean;
  revision: number;
  profileId?: string;
  network?: TestNetwork;
  address?: string;
}>;
export type WalletSessionPeer = Readonly<{ origin: string; window: Window }>;
export type WalletSessionNotificationListener = (notification: WalletSessionNotification) => void;
export type WalletSessionSourceState = Readonly<{ profileId?: string; network?: TestNetwork; address?: string }>;
export type WalletSessionSource = Readonly<{ getState(): WalletSessionSourceState; subscribe(listener: () => void): () => void }>;

function validOrigin(origin: unknown): origin is string {
  try { return typeof origin === 'string' && new URL(origin).origin === origin; } catch { return false; }
}
function validText(value: unknown): value is string { return typeof value === 'string' && value.length > 0 && value.length <= 512; }
function validNetwork(value: unknown): value is TestNetwork { return value === 'signet' || value === 'mutinynet'; }
export function isWalletSessionNotification(value: unknown): value is WalletSessionNotification {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  if (candidate.type !== 'bis.wallet-session' || candidate.version !== WALLET_SESSION_NOTIFICATION_VERSION || !['player', 'game'].includes(candidate.role as string) || typeof candidate.active !== 'boolean' || !Number.isSafeInteger(candidate.revision) || (candidate.revision as number) < 1) return false;
  if (!candidate.active) return candidate.profileId === undefined && candidate.network === undefined && candidate.address === undefined;
  return validText(candidate.profileId) && validNetwork(candidate.network) && validText(candidate.address);
}
function notification(role: WalletSessionRole, revision: number, state: WalletSessionSourceState): WalletSessionNotification {
  if (state.profileId && state.network && state.address) return Object.freeze({type:'bis.wallet-session',version:WALLET_SESSION_NOTIFICATION_VERSION,role,active:true,revision,profileId:state.profileId,network:state.network,address:state.address});
  return Object.freeze({type:'bis.wallet-session',version:WALLET_SESSION_NOTIFICATION_VERSION,role,active:false,revision});
}

/** Sends public lifecycle evidence only. It does not delegate wallet authority. */
export function createWalletSessionPublisher(peer: WalletSessionPeer) {
  if (!validOrigin(peer.origin)) throw Error('A concrete trusted wallet-session origin is required.');
  const revisions: Record<WalletSessionRole, number> = {player:0,game:0};
  return {
    publish(role: WalletSessionRole, state: WalletSessionSourceState) {
      const event = notification(role, ++revisions[role], state);
      peer.window.postMessage(event, peer.origin);
      return event;
    },
  };
}

/** Accepts only a single configured browser peer and newer role revisions. */
export function listenForWalletSessionNotifications(peer: WalletSessionPeer, receive: WalletSessionNotificationListener, host: Pick<Window, 'addEventListener' | 'removeEventListener'> = window) {
  if (!validOrigin(peer.origin)) throw Error('A concrete trusted wallet-session origin is required.');
  const revisions: Record<WalletSessionRole, number> = {player:0,game:0};
  const onMessage = (event: MessageEvent<unknown>) => {
    if (event.origin !== peer.origin || event.source !== peer.window || !isWalletSessionNotification(event.data)) return;
    if (event.data.revision <= revisions[event.data.role]) return;
    revisions[event.data.role] = event.data.revision;
    receive(event.data);
  };
  host.addEventListener('message', onMessage as EventListener);
  return () => host.removeEventListener('message', onMessage as EventListener);
}

/** Connects a business application's public controller state to its trusted Marketplace peer. */
export function publishWalletSessionLifecycle(peer: WalletSessionPeer, player: WalletSessionSource, game: WalletSessionSource) {
  const publisher = createWalletSessionPublisher(peer);
  const publish = (role: WalletSessionRole, source: WalletSessionSource) => publisher.publish(role, source.getState());
  publish('player', player); publish('game', game);
  const offPlayer = player.subscribe(() => publish('player', player));
  const offGame = game.subscribe(() => publish('game', game));
  return { dispose(options: {publishInactive?: boolean} = {}) { offPlayer(); offGame(); if (options.publishInactive) { publisher.publish('player', {}); publisher.publish('game', {}); } } };
}
