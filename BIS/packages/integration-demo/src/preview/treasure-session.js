// Host gameplay policy. BIS knows contracts; this module owns treasure/session semantics.
export function createTreasureSession({ context, offers, gameWallet, now = Date.now, newId = () => crypto.randomUUID() }) {
  let session, generation = 0, reading = false, acting = false;
  const listeners = new Set();
  const publish = () => listeners.forEach(listener => listener());
  const matches = contract => session && contract.type === 'lto' && contract.purpose === 'treasureLTO' &&
    contract.sessionId === session.id && contract.hostReference === session.reference &&
    contract.scope.playerId === session.playerId && contract.scope.gameId === session.gameId;
  function getState() {
    if (!session) return { status: 'no-offer', remainingSeconds: 0 };
    const remainingSeconds = Math.max(0, Math.ceil((session.expiresAt - now()) / 1000));
    let status = session.status;
    if (session.offered && !remainingSeconds && !['claimed', 'rejected'].includes(status)) status = 'expired';
    if (session.playerId !== context.getState().profileId && status !== 'missing-player') status = 'no-offer';
    return { status, remainingSeconds, sessionId: session.id, contractId: session.contractId };
  }
  function end() {
    generation++;
    if (session) void offers.endSession(session.id).catch(() => {});
    session = undefined; publish();
  }
  async function inspect() {
    if (!session || reading || !session.playerId) return;
    const current = generation;
    reading = true;
    try {
      const result = await offers.checkContracts({purpose:'treasureLTO',sessionId:session.id,hostReference:session.reference,gameId:session.gameId,includeResolved:true});
      if (current !== generation || !session) return;
      if (result.status !== 'ready') { session.status = 'unavailable'; publish(); return; }
      const contract = result.contracts.find(matches);
      if (!contract || (session.contractId && contract.id !== session.contractId)) return;
      session.contractId = contract.id; session.offered = true;
      session.status = contract.financial === 'claimed' ? 'claimed' : contract.financial === 'refunded' ? (session.status!=='rejected' && now()>=session.expiresAt?'expired':'rejected') : contract.eligibility === 'ended' ? 'rejected' :
        contract.financial === 'failed' ? 'no-offer' : contract.canClaim ? 'active' : contract.financial === 'funding' ? 'preparing' : 'pending';
      publish();
    } catch { if (current === generation && session) { session.status = 'unavailable'; publish(); } }
    finally { reading = false; }
  }
  return {
    getState, subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    snapshot() {return session?{...session}:undefined;},
    restore(saved) {
      if(session||!saved||typeof saved.id!=='string'||saved.reference!==`treasure:${saved.id}`||!Number.isSafeInteger(saved.expiresAt)||typeof saved.status!=='string')return false;
      session={id:saved.id,reference:saved.reference,expiresAt:saved.expiresAt,status:saved.status,offered:saved.offered===true,
        playerId:typeof saved.playerId==='string'?saved.playerId:undefined,gameId:typeof saved.gameId==='string'?saved.gameId:undefined,contractId:typeof saved.contractId==='string'?saved.contractId:undefined};
      generation++;publish();return true;
    },
    start() {
      end(); const current = generation, startedAt = now();
      const player = context.getState(), game = gameWallet.getState(), id = newId();
      session = {id,reference:`treasure:${id}`,playerId:player.profileId,gameId:game.profileId,expiresAt:startedAt+90000,offered:false,
        status:!player.profileId?'missing-player':player.phase!=='active'||game.status!=='ready'||!game.profileId||game.profileId===player.profileId?'no-offer':'preparing'};
      publish();
      if (session.status !== 'preparing') return;
      void offers.start({sessionId:id,hostReference:session.reference,purpose:'treasureLTO',exclusivityKey:'treasure',amountSats:1000,startedAt,expiresAt:session.expiresAt}).then(result => {
        if(current!==generation || !session) return;
        if(result.contract && matches(result.contract)) { session.contractId=result.contract.id; session.offered=true; }
        if(result.status==='unavailable'||result.status==='not-submitted')session.status='no-offer';
        publish(); void inspect();
      }).catch(() => { if(current===generation && session) {session.status='unavailable';publish();} });
    },
    inspect, end,
    async act(kind) {
      if (acting || !session?.contractId || getState().status !== 'active' || !['claim','reject'].includes(kind)) return {status:'unavailable'};
      const current=generation;acting=true;
      try {
        const result=await offers[kind](session.contractId);
        if(current!==generation||!session)return {status:'unavailable'};
        if(result.status==='pending')session.status=kind==='reject'?'rejected':'pending';
        else if(result.status==='too-late')session.status='expired';
        else session.status='unavailable';
        publish();return result;
      } catch {if(current===generation&&session){session.status='unavailable';publish();}return {status:'unavailable'};}
      finally {acting=false;}
    },
    dispose({preserveSession=false}={}) {if(!preserveSession)end();listeners.clear();},
  };
}

export function treasureMessage(status) {
  return ({active:'You found a treasure of 1000 sats',preparing:'Treasure is being prepared',expired:"You found a treasure but it's expired",
    'missing-player':'Connect an account to receive treasure offers','no-offer':'No treasure offer available',unavailable:'Treasure status is unavailable',
    pending:'Treasure transaction is pending',claimed:'Reward claimed',rejected:'Offer ended'})[status] ?? 'No treasure offer available';
}
