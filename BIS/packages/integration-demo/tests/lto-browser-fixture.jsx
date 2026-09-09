import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {TreasureLtoPanel} from '../src/admin/TreasureLtoPanel.tsx';
import {AccountContracts} from '../../integration/src/ui/AccountContracts.tsx';
import {createLtoService} from '../../integration/src/core/lto-service.ts';
import {createContractStorage} from '../../integration/src/core/contract-storage.ts';
import {markContractSubmission,finishContractOperation} from '../../integration/src/core/contracts.ts';
import '../../integration/src/ui/overlay.css';
let mode='success',release,offset=0,offline=false,profileId='player',emit=()=>{};
const clock=Date.now;Date.now=()=>clock()+offset;
const events=[];const log=value=>{events.push(value);emit();};
const storage=createContractStorage(),game={profileId:'game',phrase:'unfunded-fixture'};
const context={getState:()=>({profileId,phase:'active'}),refreshBalance:async()=>{},showToast:message=>log({toast:message}),closeAccount:()=>{}};
const gameWallet={getState:()=>({profileId:'game',status:'ready'}),refresh:async()=>{}};
const dependencies={storage,playerStorage:{load:async()=>({account:{profileId:'player',phrase:'unfunded-fixture'}})},gameStorage:{load:async()=>game,dispose(){}},poll:false,
 prepare:async()=>({secretHex:'12'.repeat(32),playerKey:'23'.repeat(32),gameKey:'34'.repeat(32),operatorKey:'45'.repeat(32),exitDelay:'512',gameScript:'00',playerScript:'01',contractScript:'02'}),
 reconcile:async(record,recovery)=>({record,recovery}),resume:async(record,recovery)=>({record,recovery}),
 submit:async(record,recovery,account,commit,current)=>{
  if(!current())throw Error('fixture identity changed');log({submission:record.operation.kind});
  const txid=crypto.randomUUID().replaceAll('-','').repeat(2),material={...recovery,spend:{operationId:record.operation.id,transactionId:txid,inputs:[recovery.fundingOutput??{txid:'a'.repeat(64),vout:0,value:1000}],destinationScript:'00',amountSats:1000}};
  record=markContractSubmission(record,record.operation.id,Date.now());await commit(record,material);
  if(mode==='pending')await new Promise(resolve=>{release=resolve;});
  if(mode==='unknown'){record=markContractSubmission(record,record.operation.id,Date.now(),true);await commit(record,material);return {record,recovery:material};}
  record=finishContractOperation(record,{operationId:record.operation.id,kind:record.operation.kind,outcome:'confirmed'});
  if(record.operation.kind==='fund')material.fundingOutput={txid,vout:0,value:1000};
  await commit(record,material);return {record,recovery:material};
 }};
const service=createLtoService({context,gameWallet},dependencies);
context.checkContracts=filter=>offline?Promise.resolve({status:'unavailable',contracts:[]}):service.checkContracts(filter);
context.claimContract=service.claim;context.rejectContract=service.reject;context.refundContract=service.refund;
const offers={...service,checkContracts:context.checkContracts};
function Fixture(){const [,render]=useState(0);emit=()=>render(value=>value+1);return <main>
<h1>Automated fixture — simulated transactions only</h1>
<div><button onClick={()=>{mode='pending';}}>Hold operations</button><button onClick={()=>{mode='success';release?.();}}>Complete operation</button><button onClick={()=>{mode='unknown';release?.();}}>Lose acknowledgement</button><button onClick={()=>{offset+=91000;}}>Advance 91 seconds</button><button onClick={()=>void service.reconcile()}>Reconcile</button><button onClick={()=>{offline=!offline;}}>Toggle unavailable read</button><button onClick={()=>{profileId=profileId==='player'?'game':'player';render(value=>value+1);}}>Switch role</button><button onClick={()=>{profileId='replacement';render(value=>value+1);}}>Replace account</button></div>
<div style={{display:'flex',gap:20}}><section style={{width:300}}><TreasureLtoPanel context={context} offers={offers} gameWallet={gameWallet} onLog={log}/></section><section style={{width:320}}><AccountContracts key={profileId} context={context} onDetailChange={()=>{}}/></section></div>
<textarea aria-label="Fixture events" readOnly value={JSON.stringify(events)} style={{width:'95%',height:180}}/>
</main>};createRoot(document.getElementById('root')).render(<Fixture/>);
