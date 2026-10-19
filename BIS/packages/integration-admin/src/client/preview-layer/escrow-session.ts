import type { BisContext, BisContract, BisContractActionResult, BisState, createBisGameWallet, createBisLto } from '@bis/integration';

export type EscrowStatus = 'no-escrow' | 'missing-wallet' | 'preparing' | 'funding' | 'funded' | 'approved' | 'pending' | 'claimed' | 'expired' | 'refunded' | 'failed' | 'not-found' | 'already-taken' | 'unavailable';
export type EscrowSnapshot = Readonly<{
  id: string; amountSats: number; expiresAt?: number; remainingSeconds: number; approved: boolean; status: EscrowStatus;
  contractId?: string; message?: string; feeSats?: number; evidence?: BisContract['evidence'];
}>;
type Offers = ReturnType<typeof createBisLto>;
type GameWallet = ReturnType<typeof createBisGameWallet>;

function readinessReason(player: BisState, game: ReturnType<GameWallet['getState']>) {
  if (!player.profileId) return 'Connect a Player Wallet before creating escrow.';
  if (player.phase !== 'active') return 'The Player Wallet is not ready yet.';
  if (!game.profileId) return 'Select a Game Wallet before creating escrow.';
  if (game.status !== 'ready') return game.message || 'The Game Wallet is not ready yet.';
  if (game.profileId === player.profileId) return 'Select a separate Game Wallet from the Player Wallet.';
  return undefined;
}

export function createEscrowSession({context,offers,gameWallet,now=Date.now}:{context:BisContext;offers:Offers;gameWallet:GameWallet;now?:()=>number}) {
  let id='smart-escrow-1', amountSats=1000, approveUponCreation=false;
  let snapshot: EscrowSnapshot = {id,amountSats,remainingSeconds:0,approved:false,status:'no-escrow'};
  let generation=0, busy=false;
  const listeners=new Set<()=>void>();
  const publish=()=>listeners.forEach(listener=>listener());
  const setSnapshot=(next:EscrowSnapshot)=>{snapshot=next;publish();};
  const match=(contract:BisContract)=>contract.type==='lto'&&contract.purpose==='smartContractEscrow'&&contract.sessionId===id;
  const remaining=(expiresAt?:number)=>expiresAt===undefined?0:Math.max(0,Math.ceil((expiresAt-now())/1000));
  function configure(nextId:string,nextAmount:number,nextApproved:boolean) {
    if(busy)return;
    id=nextId;amountSats=nextAmount;approveUponCreation=nextApproved;
    snapshot={id,amountSats,remainingSeconds:0,approved:nextApproved,status:'no-escrow'};publish();
  }
  async function check():Promise<EscrowSnapshot> {
    const current=++generation;
    if(busy)return snapshot;
    try {
      const result=await offers.checkContractsAsync({purpose:'smartContractEscrow',sessionId:id,includeResolved:true});
      if(current!==generation)return snapshot;
      if(result.status!=='ready'){setSnapshot({...snapshot,status:'unavailable',message:'Escrow evidence is unavailable.'});return snapshot;}
      const contract=result.contracts.find(match);
      if(!contract){setSnapshot({...snapshot,status:'not-found',message:'No escrow exists for this ID.'});return snapshot;}
      const seconds=remaining(contract.expiresAt);
      const status:EscrowStatus=contract.financial==='claimed'?'claimed':contract.financial==='refunded'?'refunded':contract.financial==='failed'?'failed':seconds===0?'expired':contract.financial==='funding'?'funding':contract.approved?'approved':'funded';
      setSnapshot({id,amountSats:contract.amountSats,expiresAt:contract.expiresAt,remainingSeconds:seconds,approved:contract.approved,status,contractId:contract.id,feeSats:0,evidence:contract.evidence});
      return snapshot;
    }catch{setSnapshot({...snapshot,status:'unavailable',message:'Escrow status could not be verified.'});return snapshot;}
  }
  async function send():Promise<BisContractActionResult|undefined> {
    const player=context.getState(), game=gameWallet.getState(), reason=readinessReason(player,game);
    if(reason){setSnapshot({...snapshot,status:'missing-wallet',message:reason});return;}
    if(!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(id)||!Number.isSafeInteger(amountSats)||amountSats<330){setSnapshot({...snapshot,status:'unavailable',message:'Use a valid ID and an amount of at least 330 sats.'});return;}
    if(busy)return {status:'pending'};
    busy=true;const current=++generation;setSnapshot({...snapshot,status:'preparing',message:undefined});
    try {
      const startedAt=now(),expiresAt=startedAt+120000;
      const result=await offers.start({sessionId:id,hostReference:`escrow:${id}`,purpose:'smartContractEscrow',exclusivityKey:`smartContractEscrow:${id}`,amountSats,startedAt,expiresAt,approveUponCreation});
      if(current!==generation)return result;
      if(result.status==='already-taken'){setSnapshot({...snapshot,status:'already-taken',message:'That escrow ID is already taken.'});return result;}
      if(result.contract){setSnapshot({id,amountSats:result.contract.amountSats,expiresAt:result.contract.expiresAt,remainingSeconds:remaining(result.contract.expiresAt),approved:result.contract.approved,status:result.status==='pending'?'pending':result.contract.approved?'approved':'funded',contractId:result.contract.id,feeSats:0,evidence:result.contract.evidence});}
      else setSnapshot({...snapshot,status:result.status==='pending'?'pending':'unavailable'});
      return result;
    }catch{setSnapshot({...snapshot,status:'unavailable',message:'Escrow could not be created.'});return {status:'unavailable'};}
    finally{busy=false;}
  }
  async function approve():Promise<BisContractActionResult> {
    if(busy||!snapshot.contractId)return {status:'unavailable'};
    busy=true;try{const result=await offers.approve(snapshot.contractId);await check();return result;}catch{return {status:'unavailable'};}finally{busy=false;}
  }
  async function receive():Promise<BisContractActionResult> {
    if(busy||!snapshot.contractId)return {status:'unavailable'};
    busy=true;try{const result=await offers.claim(snapshot.contractId);await check();return result;}catch{return {status:'unavailable'};}finally{busy=false;}
  }
  const timer=setInterval(()=>{if(snapshot.expiresAt!==undefined){const seconds=remaining(snapshot.expiresAt);if(seconds!==snapshot.remainingSeconds){snapshot={...snapshot,remainingSeconds:seconds,status:seconds===0&&!['claimed','refunded'].includes(snapshot.status)?'expired':snapshot.status};publish();}}},250);
  return {getState:()=>snapshot,subscribe(listener:()=>void){listeners.add(listener);return()=>listeners.delete(listener);},configure,check,send,approve,receive,isBusy:()=>busy,dispose(){clearInterval(timer);listeners.clear();generation++;}};
}
