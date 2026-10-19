import {useEffect,useMemo,useState} from 'react';
import type {BisContext,createBisGameWallet,createBisLto} from '@bis/integration';
import {StoryButton} from './StoryButton';
import {createEscrowSession, type EscrowStatus} from '../preview-layer/escrow-session';

const label=(status:EscrowStatus)=>status.replaceAll('-',' ');
export function EscrowPanel({context,offers,gameWallet,onLog}:{context?:BisContext;offers?:ReturnType<typeof createBisLto>;gameWallet?:ReturnType<typeof createBisGameWallet>;onLog:(result:unknown)=>void}) {
  const controller=useMemo(()=>context&&offers&&gameWallet?createEscrowSession({context,offers,gameWallet}):undefined,[context,offers,gameWallet]);
  const [id,setId]=useState('smart-escrow-1'),[amount,setAmount]=useState('1000'),[approveOnCreate,setApproveOnCreate]=useState(false),[state,setState]=useState(controller?.getState());
  useEffect(()=>{setState(controller?.getState());if(!controller)return;const unsubscribe=controller.subscribe(()=>setState(controller.getState()));return()=>{unsubscribe();controller.dispose();};},[controller]);
  function configure(){controller?.configure(id,Number(amount),approveOnCreate);onLog({call:'Send Escrow',id,amountSats:Number(amount),approveUponCreation:approveOnCreate});}
  async function send(){configure();const result=await controller?.send();onLog({call:'Send Escrow',result,state:controller?.getState()});}
  async function check(){const result=await controller?.check();onLog({call:'Check Escrow',result,feeSats:0,state:controller?.getState()});}
  async function approve(){const result=await controller?.approve();onLog({call:'Approve Escrow',result,state:controller?.getState()});}
  async function receive(){const result=await controller?.receive();onLog({call:'Receive Escrow',result,state:controller?.getState()});}
  const unavailable=!controller||!context?.getState().profileId||!gameWallet?.getState().profileId;
  const commonDisabled=unavailable||controller?.isBusy()===true;
  return <StoryButton label="D1. Smart Escrow" sublabel={<span className="game-wallet-balance" aria-label="Escrow status">{state?`${label(state.status)} · ${state.remainingSeconds}s · ${state.approved?'approved':'not approved'} · fee ${state.feeSats??0} sats`:'Unavailable'}</span>}>
    <label>ID <input aria-label="Escrow ID" value={id} onChange={event=>setId(event.target.value)} disabled={commonDisabled}/></label>
    <label>Sats <input aria-label="Escrow amount" inputMode="numeric" value={amount} onChange={event=>setAmount(event.target.value)} disabled={commonDisabled}/></label>
    <label><input type="checkbox" aria-label="Approve upon creation" checked={approveOnCreate} onChange={event=>setApproveOnCreate(event.target.checked)} disabled={commonDisabled}/> Approve on create</label>
    <button type="button" onClick={()=>void send()} disabled={commonDisabled}>Send Escrow</button>
    <button type="button" onClick={()=>void check()} disabled={!controller||controller.isBusy()}>Check Escrow</button>
    <button type="button" onClick={()=>void approve()} disabled={!controller||controller.isBusy()||!state?.contractId||state.approved||state.status==='expired'||state.status==='claimed'||state.status==='refunded'}>Approve Escrow</button>
    <button type="button" onClick={()=>void receive()} disabled={!controller||controller.isBusy()||!state?.contractId||!state.approved||state.status!=='approved'}>Receive Escrow</button>
  </StoryButton>;
}
