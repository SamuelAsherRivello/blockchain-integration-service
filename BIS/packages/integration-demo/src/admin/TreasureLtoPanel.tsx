import {useEffect,useMemo,useRef,useState} from 'react';
import type {BisContext,createBisGameWallet,createBisLto} from '@bis/integration';
import {createTreasureSession,treasureMessage} from '../preview/treasure-session.js';
import {StoryButton} from './StoryButton';

/** Admin simulates Start and collision/Claim; financial decisions remain in BIS. */
export function TreasureLtoPanel({context,offers,gameWallet,onLog}:{context?:BisContext;offers?:ReturnType<typeof createBisLto>;gameWallet?:ReturnType<typeof createBisGameWallet>;onLog:(result:unknown)=>void}) {
  const controller=useMemo(()=>context&&offers&&gameWallet?createTreasureSession({context,offers,gameWallet}):undefined,[context,offers,gameWallet]);
  const [deadline,setDeadline]=useState<number>(),[remaining,setRemaining]=useState(0);
  const latest=useRef(controller);latest.current=controller;
  const log=useRef(onLog);log.current=onLog;
  useEffect(()=>{
    setDeadline(undefined);setRemaining(0);
    let previous='',previousOfferKey='',active=true;
    const report=()=>{
      if(!active||!controller)return;
      const state=controller.getState(),key=JSON.stringify([state.sessionId,state.contractId,state.status,state.reason]);
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
      const message=state.reason||treasureMessage(state.status);
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
    if(!controller){const message='BIS and the game wallet are not ready. No offer was created.';log.current({event:'Start LTO',status:'unavailable',message});context?.showToast(message,{messageType:'warning'});return;}
    void controller.start();
  }
  async function claim(){
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
    if (result.status !== 'pending') context?.showToast(result.status === 'too-late' ? "You found a treasure but it's expired" : result.status === 'not-submitted' ? 'Contract claim was not submitted.' : treasureMessage(before.status), {messageType:'warning'});
  }
  return <StoryButton label="G2. LTO Treasure Chest" sublabel={<span className="game-wallet-balance" aria-label="LTO time left" style={{fontVariantNumeric:'tabular-nums'}}>Time left: {remaining}s</span>}>
    <button type="button" onClick={start}>Start LTO</button>
    <button type="button" onClick={()=>void claim()}>Claim LTO</button>
  </StoryButton>;
}
