import type { BisContext, BisContract, BisContractActionResult, BisState, createBisGameWallet, createBisLto } from '@bis/integration';

// Host gameplay policy. BIS knows contracts; this module owns treasure/session semantics.
export type TreasureStatus = 'no-offer' | 'missing-player' | 'preparing' | 'active' | 'unavailable' | 'pending' | 'claimed' | 'rejected' | 'expired';
export type TreasureSnapshot = {
  id: string; reference: string; expiresAt: number; status: TreasureStatus; offered: boolean;
  reason?: string; playerId?: string; gameId?: string; contractId?: string; gameVersion?: number;
  validationMode?:'browser-policy-v1'|'arkade-covenant-v2';
  network?: BisState['network'];
};
type TreasureSession = TreasureSnapshot;
type TreasureOffers = ReturnType<typeof createBisLto>;
type TreasureGameWallet = ReturnType<typeof createBisGameWallet>;
type TreasureGameState = ReturnType<TreasureGameWallet['getState']>;
type TreasureOptions = {
  context: BisContext; offers: TreasureOffers; gameWallet: TreasureGameWallet;
  now?: () => number; newId?: () => string;
};

export function createTreasureSession({ context, offers, gameWallet, now = Date.now, newId = () => crypto.randomUUID() }: TreasureOptions) {
  let session: TreasureSession | undefined, generation = 0, acting = false, startChain: Promise<void> = Promise.resolve(), startActive = false;
  let inspection: {generation:number;promise:Promise<void>} | undefined;
  const listeners = new Set<() => void>();
  const publish = () => listeners.forEach(listener => listener());
  const matches = (contract: BisContract | undefined) => Boolean(session && contract && contract.type === 'lto' && contract.purpose === 'treasureLTO' &&
    contract.sessionId === session.id && contract.hostReference === session.reference &&
    contract.scope.playerId === session.playerId && contract.scope.gameId === session.gameId &&
    contract.scope.network === session.network && contract.expiresAt === session.expiresAt);
  function readinessReason(player: BisState, game: TreasureGameState): string | undefined {
    if (!player.profileId) return 'Connect a Player Wallet before starting an LTO.';
    if (player.phase !== 'active') return 'The Player Wallet is not ready yet.';
    if (player.network !== game.network) return 'Select Player and Game Wallets on the same network.';
    if (!game.profileId) return 'Select a Game Wallet before starting an LTO.';
    if (game.status !== 'ready') return game.message || 'The Game Wallet is not ready yet.';
    if (game.profileId === player.profileId) return 'Select a separate Game Wallet from the Player Wallet.';
    return undefined;
  }
  function getState(): { status: TreasureStatus; remainingSeconds: number; sessionId?: string; contractId?: string; reason?: string; validationMode?:TreasureSnapshot['validationMode'] } {
    if (!session) return { status: 'no-offer', remainingSeconds: 0 };
    const remainingSeconds = Math.max(0, Math.ceil((session.expiresAt - now()) / 1000));
    let status: TreasureStatus = session.status;
    if (session.offered && !remainingSeconds && !['claimed', 'rejected','pending'].includes(status)) status = 'expired';
    if (session.playerId !== context.getState().profileId && status !== 'missing-player') status = 'no-offer';
    if (session.network !== context.getState().network || session.network !== gameWallet.getState().network) status = 'no-offer';
    if (gameWallet.getState().selectionVersion !== session.gameVersion) status = 'no-offer';
    return { status, remainingSeconds, sessionId: session.id, contractId: session.contractId, reason: session.reason, validationMode:session.validationMode };
  }
  function end() {
    generation++;
    if (session) void offers.endSession(session.id).catch(() => {});
    session = undefined; publish();
  }
  function inspect(): Promise<void> {
    if (!session || !session.playerId || session.network !== context.getState().network || session.network !== gameWallet.getState().network) return Promise.resolve();
    const current = generation;
    if(inspection?.generation===current)return inspection.promise;
    const selected = session;
    const promise=(async()=>{
    try {
      const result = await Promise.resolve().then(()=>offers.checkContractsAsync({purpose:'treasureLTO',sessionId:selected.id,hostReference:selected.reference,gameId:selected.gameId,includeResolved:true}));
      if (current !== generation || session!==selected || selected.network!==context.getState().network || selected.network!==gameWallet.getState().network) return;
      if (result.status !== 'ready') { session.status = 'unavailable'; publish(); return; }
      const contract = result.contracts.find(matches);
      if (!contract || (session.contractId && contract.id !== session.contractId)) { session.status='unavailable';publish();return; }
      session.contractId = contract.id; session.offered = true;session.validationMode=contract.validationMode;
      session.status = contract.financial === 'claimed' ? 'claimed' : contract.financial === 'refunded' ? (session.status!=='rejected' && now()>=session.expiresAt?'expired':'rejected') : contract.eligibility === 'ended' ? 'rejected' :
        contract.financial === 'failed' ? 'no-offer' : contract.canClaim ? 'active' : contract.financial === 'funding' ? 'preparing' : 'pending';
      publish();
    } catch { if (current === generation && session) { session.status = 'unavailable'; publish(); } }
    finally { if(inspection?.generation===current)inspection=undefined; }
    })();
    inspection={generation:current,promise};
    return promise;
  }
  const unsubscribeGameWallet = gameWallet.subscribe?.(() => { if (session && gameWallet.getState().selectionVersion !== session.gameVersion) publish(); });
  return {
    getState, subscribe(listener: () => void) { listeners.add(listener); return () => listeners.delete(listener); },
    snapshot() {return session?{...session}:undefined;},
    restore(saved: unknown): boolean {
      const candidate = saved as Partial<TreasureSnapshot> | null;
      if(session||!candidate||typeof candidate.id!=='string'||candidate.reference!==`treasure:${candidate.id}`||typeof candidate.expiresAt!=='number'||!Number.isSafeInteger(candidate.expiresAt)||typeof candidate.status!=='string')return false;
      const expiresAt = candidate.expiresAt;
      const restored: TreasureSession = {id:candidate.id,reference:candidate.reference,expiresAt,status:'unavailable',network:candidate.network,reason:typeof candidate.reason==='string'?candidate.reason:undefined,offered:candidate.offered===true,
        playerId:typeof candidate.playerId==='string'?candidate.playerId:undefined,gameId:typeof candidate.gameId==='string'?candidate.gameId:undefined,contractId:typeof candidate.contractId==='string'?candidate.contractId:undefined,
        validationMode:candidate.validationMode==='browser-policy-v1'||candidate.validationMode==='arkade-covenant-v2'?candidate.validationMode:undefined};
      restored.gameVersion=typeof candidate.gameVersion==='number'?candidate.gameVersion:gameWallet.getState().selectionVersion;
      session = restored;
      generation++;publish();return true;
    },
    start(validationSolution?:'browser-policy-v1'|'arkade-covenant-v2'): Promise<BisContractActionResult | undefined> {
      const run = async (): Promise<BisContractActionResult | undefined> => {
        const previous = session;
        generation++;
        session = undefined;
        publish();
        if (previous) {
          try { await offers.endSession(previous.id); }
          catch { publish(); return; }
        }
        const current = generation, startedAt = now();
        const player = context.getState(), game = gameWallet.getState(), id = newId();
        const reason = readinessReason(player, game);
        session = {id,reference:`treasure:${id}`,network:player.network,playerId:player.profileId,gameId:game.profileId,gameVersion:game.selectionVersion,expiresAt:(Math.floor(startedAt/1000)+90)*1000,offered:false,reason,validationMode:validationSolution,
          status:!player.profileId?'missing-player':reason?'no-offer':'preparing'};
        publish();
        if (session.status !== 'preparing') return;
        try {
          const result = await offers.start({sessionId:id,hostReference:session.reference,purpose:'treasureLTO',exclusivityKey:'treasure',amountSats:1000,startedAt,expiresAt:session.expiresAt,...(validationSolution?{validationSolution}:{})});
          if(current!==generation || !session) return result;
          if(result.contract && matches(result.contract)) { session.contractId=result.contract.id; session.offered=true;session.validationMode=result.contract.validationMode; }
          if(result.status==='unavailable'||result.status==='not-submitted') { session.status='no-offer'; session.reason=validationSolution==='arkade-covenant-v2'?'No offer was created. Check co-signer availability and Game Wallet readiness. This selection does not fall back to browser validation.':'No offer was created. Check that the Game Wallet is funded and ready.'; }
          publish(); void inspect();
          return result;
        } catch {
          if(current===generation && session) {session.status='unavailable';session.reason='The Game Wallet could not create the offer.';publish();}
        }
      };
      if (!startActive) {
        startActive = true;
        const first = run();
        startChain = first.then(() => undefined, () => undefined).finally(() => { startActive = false; });
        return first;
      }
      startActive = true;
      const next = startChain.then(run, run);
      startChain = next.then(() => undefined, () => undefined).finally(() => { startActive = false; });
      return next;
    },
    inspect, end,
    async act(kind: 'claim' | 'reject'): Promise<BisContractActionResult> {
      if (acting || !session?.contractId || getState().status !== 'active' || !['claim','reject'].includes(kind)) return {status:'unavailable'};
      const current=generation;acting=true;
      try {
        const result = kind === 'claim' ? await offers.claim(session.contractId) : await offers.reject(session.contractId);
        if(current!==generation||!session)return {status:'unavailable'};
        if(result.status==='pending')session.status='pending';
        else if(result.status==='too-late')session.status='expired';
        else session.status='unavailable';
        publish();return result;
      } catch {if(current===generation&&session){session.status='unavailable';publish();}return {status:'unavailable'};}
      finally {acting=false;}
    },
    dispose({preserveSession=false}: { preserveSession?: boolean } = {}) {if(!preserveSession)end();unsubscribeGameWallet?.();listeners.clear();},
  };
}

export function treasureMessage(status: TreasureStatus): string {
  return ({active:'You found a treasure of 1000 sats',preparing:'Treasure is being prepared',expired:"You found a treasure but it's expired",
    'missing-player':'Connect an account to receive treasure offers','no-offer':'No treasure offer available',unavailable:'Treasure status is unavailable',
    pending:'Treasure transaction is pending',claimed:'Reward claimed',rejected:'Offer ended'})[status] ?? 'No treasure offer available';
}
