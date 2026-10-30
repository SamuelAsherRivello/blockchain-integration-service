import {useEffect,useMemo,useRef,useState} from 'react';
import {contractValidationOptions,contractValidationDescription,type ContractValidationMode,type BisContext,type createBisGameWallet,type createBisLto} from '@bis/integration';
import {createTreasureSession,treasureMessage} from '../preview-layer/treasure-session.ts';
import {StoryButton} from './StoryButton';

/** Admin simulates Start and collision/Claim; financial decisions remain in BIS. */
export function TreasureOfferPanel({context,offers,gameWallet,onLog}:{context?:BisContext;offers?:ReturnType<typeof createBisLto>;gameWallet?:ReturnType<typeof createBisGameWallet>;onLog:(result:unknown)=>void}) {
  const controller=useMemo(()=>context&&offers&&gameWallet?createTreasureSession({context,offers,gameWallet}):undefined,[context,offers,gameWallet]);
  const [deadline,setDeadline]=useState<number>(),[remaining,setRemaining]=useState(0);
  const network=context?.getState().network??'signet';
  const [solution,setSolution]=useState<ContractValidationMode>('browser-policy-v1');
  const [inProgress,setInProgress]=useState(false);
  const [claimBusy,setClaimBusy]=useState(false);
  const claimFlight=useRef<object|undefined>(undefined);
  const selectedSolution=inProgress?solution:'browser-policy-v1';
  const newOfferModes=contractValidationOptions(network);
  const displayedModes=inProgress&&!newOfferModes.includes(selectedSolution)?[selectedSolution,...newOfferModes]:newOfferModes;
  useEffect(()=>{setSolution('browser-policy-v1');},[network]);
  const latest=useRef(controller);latest.current=controller;
  const log=useRef(onLog);log.current=onLog;
  useEffect(()=>{
    claimFlight.current=undefined;setClaimBusy(false);
    setDeadline(undefined);setRemaining(0);
    let previous='',previousOfferKey='',active=true;
    const report=()=>{
      if(!active||!controller)return;
      const state=controller.getState(),key=JSON.stringify([state.sessionId,state.contractId,state.status,state.reason]);
      setInProgress(['preparing','active','pending'].includes(state.status));
      if(state.validationMode&&['preparing','active','pending'].includes(state.status))setSolution(state.validationMode);
      const offerInPlay=Boolean(state.contractId&&['preparing','active'].includes(state.status));
      const offerKey=offerInPlay?`${state.sessionId}:${state.contractId}`:'';
      if (offerKey && offerKey!==previousOfferKey) {
        previousOfferKey=offerKey;
        setDeadline(Date.now()+state.remainingSeconds*1000);
        setRemaining(state.remainingSeconds);
      } else if (!offerInPlay && previousOfferKey) {
        previousOfferKey='';setDeadline(undefined);setRemaining(0);
      }
      if(key===previous||!state.sessionId)return;previous=key;
      const message=state.status === 'unavailable' || state.status === 'no-offer' ? 'The limited-time offer Treasure is unavailable.' : treasureMessage(state.status);
      log.current({event:'LTO status',...state,message,...(state.reason?{reason:state.reason}:{})});
      if (state.status === 'unavailable' || state.status === 'no-offer') context?.showToast(message, {messageType:'warning'});
    };
    const unsubscribe=controller?.subscribe(report);
    const timer=setInterval(()=>{void controller?.inspect().then(report);},500);
    return()=>{active=false;clearInterval(timer);unsubscribe?.();controller?.dispose();};
  },[controller]);
  useEffect(()=>{
    if(deadline===undefined)return;
    const tick=()=>setRemaining(Math.max(0,Math.ceil((deadline-Date.now())/1000)));
    tick();const timer=setInterval(tick,250);return()=>clearInterval(timer);
  },[deadline]);
  function start(){
    log.current({event:'Start LTO',message:'Starting a new 90-second session. Any prior offer must resolve before replacement.'});
    if(!controller){const message='The limited-time offer Treasure could not be created.';log.current({event:'Start LTO',status:'unavailable',message});context?.showToast(message,{messageType:'warning'});return;}
    void controller.start('browser-policy-v1');
  }
  async function claim(){
    // Guard before even the shared inspection await. A second UI invocation
    // must not produce a misleading unavailable toast for the first claim.
    if(claimFlight.current)return;
    const flight={};claimFlight.current=flight;setClaimBusy(true);
    try {
    log.current({event:'Claim LTO',status:'checking',message:'Checking the current treasure offer and claim eligibility.'});
    const current=controller;
    if(!current){log.current({event:'Claim LTO',status:'unavailable',message:'No ready treasure session.'});return;}
    // Refresh eligibility before acting; act also revalidates and guards duplicate clicks.
    await current.inspect();
    if(latest.current!==current)return;
    const before=current.getState();
    const result=await current.act('claim');
    if(latest.current!==current)return;
    log.current({event:'Claim LTO',status:result.status,sessionId:before.sessionId,contractId:before.contractId,message:result.status==='pending'?'Claim pending; confirmation will arrive without interrupting play.':treasureMessage(before.status)});
    if (result.status !== 'pending') context?.showToast(result.status === 'too-late' ? 'The limited-time offer Treasure has expired.' : result.status === 'not-submitted' ? 'You could not claim limited-time offer Treasure.' : result.status === 'confirmed' ? 'You claimed limited-time offer Treasure. (Confirmed)' : 'The limited-time offer Treasure is unavailable.', {messageType:result.status === 'confirmed' ? 'success' : 'warning'});
    } finally {if(claimFlight.current===flight){claimFlight.current=undefined;setClaimBusy(false);}}
  }
  return <StoryButton label="D.G.1 / D.P.2. LTO Treasure Chest" sublabel={<span className="game-wallet-balance" aria-label="LTO time left" style={{fontVariantNumeric:'tabular-nums'}}>Time left: {remaining}s</span>}>
    <div style={{display:'flex',flexDirection:'column',gap:'0.75rem',width:'100%',minWidth:0,whiteSpace:'normal'}}>
    <label style={{display:'flex',flexDirection:'column',gap:'0.35rem',minWidth:0}}>Signing / validation solution
      <select aria-label="Signing / validation solution" aria-describedby="treasure-validation-description" value={selectedSolution}
        style={{width:'100%',minWidth:0}} disabled={inProgress} onChange={event=>setSolution(event.target.value as ContractValidationMode)}>
        {displayedModes.map(mode=><option key={mode} value={mode}>{mode==='arkade-covenant-v2'?'Arkade co-signer (existing offer)':'Browser validation (less secure)'}</option>)}
      </select>
    </label>
    <p id="treasure-validation-description" style={{maxWidth:'60ch',margin:0,overflowWrap:'break-word'}}>{contractValidationDescription(selectedSolution)} New offers use Browser validation. Arkade co-signer validation is unavailable in this release.</p>
    <p style={{maxWidth:'60ch',margin:0}}>Start LTO locks 1,000 sats from your selected Game Wallet for this offer. {network==='mutinynet'?'Both wallets are controlled in this browser.':'The Player Wallet is controlled in this browser. Game Wallet signing runs on BIS Server.'} This is not a protected publisher-funded reward treasury.</p>
    <div style={{display:'flex',flexWrap:'wrap',gap:'0.5rem'}}>
    <button type="button" disabled={claimBusy} onClick={start}>Start LTO</button>
    <button type="button" disabled={claimBusy} aria-busy={claimBusy} onClick={()=>void claim()}>Claim LTO</button>
    </div>
    <span role="status" aria-live="polite" style={{minHeight:'1.5em'}}>{claimBusy?'Checking the treasure claim. Confirmation may take longer.':''}</span>
    </div>
  </StoryButton>;
}

