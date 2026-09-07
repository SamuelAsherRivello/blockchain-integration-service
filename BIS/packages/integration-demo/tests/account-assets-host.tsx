import { createContext } from '../../integration/src/core/context';
import { createBisUi } from '@bis/integration';
import { formatAssetDetail } from '../../integration/src/core/asset-presentation';
import type { BisAsset } from '../../integration/src/core/assets';
import '@bis/integration/style.css';

const host=document.getElementById('host')!,result=document.getElementById('result')!;
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
const wait=async(predicate:()=>boolean)=>{const end=Date.now()+35000;while(!predicate()){if(Date.now()>end)throw Error('UI update timed out');await tick();}};
const check=(condition:unknown,label:string)=>{if(!condition)throw Error(label);};
const button=(name:string)=>{const b=[...host.querySelectorAll('button')].find(b=>b.textContent===name||b.getAttribute('aria-label')===name);if(!b)throw Error(`Missing button: ${name}`);return b;};
const iconUrl='https://samuelasherrivello.github.io/blockchain-integration-service/assets/achievements/v1/level-1-trophy.png';
const rows:BisAsset[]=Array.from({length:24},(_,i)=>({assetId:`${String(i).padStart(2,'0')}${'a'.repeat(62)}${String(i).padStart(4,'0')}`,quantity:i===0?'9007199254740993':'1',name:i===23?'Very long asset metadata '.repeat(15):i===22?undefined:'Achievement: Level 1',ticker:i===22?undefined:'LVL1',decimals:i===22?undefined:0,iconUrl:i===22?'javascript:alert(1)':iconUrl}));
let data=rows,mode='ready',reads=0,copied='',copyMode='success';
let burns=0,finishBurn:((success:boolean)=>void)|undefined;
let resolveRead:((rows:BisAsset[])=>void)|undefined,finishCopy:(()=>void)|undefined;
const originalClipboard=Object.getOwnPropertyDescriptor(navigator,'clipboard');
Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async(text:string)=>{copied=text;if(copyMode==='fail')throw Error('denied');if(copyMode==='pending')await new Promise<void>(resolve=>{finishCopy=resolve;});}}});
const account={phrase:'isolated-placeholder',profileId:'asset-browser-fixture'};
const context=createContext({load:async()=>({account,generation:0}),save:async()=>{throw Error('unexpected storage write');},reset:async()=>{},subscribe:()=>()=>{}},undefined,async()=>account.profileId,undefined,undefined,undefined,undefined,async(_account,signal,publish)=>{publish([{id:'tx-fixture',amountSats:100,direction:'Incoming',status:'Confirmed',identifier:'fixture-tx'}]);await new Promise<void>(resolve=>signal.addEventListener('abort',()=>resolve(),{once:true}));},undefined,{
  list:async()=>{reads++;if(mode==='fail')throw Error('fixture failure');if(mode==='pending')return new Promise<BisAsset[]>(resolve=>{resolveRead=resolve;});return data;},
  mint:async()=>{throw Error('unexpected mint');},
},undefined,async(_account,request)=>{
  burns++;const success=await new Promise<boolean>(resolve=>{finishBurn=resolve;});
  if(!success)return {status:'error',code:'unavailable',message:'Fixture burn unavailable.'};
  check(request.quantity===data.find(row=>row.assetId===request.assetId)?.quantity,'exact selected holding burned');
  data=data.filter(row=>row.assetId!==request.assetId);
  return {status:'burned',assetId:request.assetId,quantity:request.quantity,transactionId:'c'.repeat(64)};
});
const ui=createBisUi(context);ui.mount(host);
const showList=async()=>{await context.ready();mode='ready';data=rows;copyMode='success';context.openAccountDialog();if(context.getState().accountAssets)context.closeAccount();context.openAccountAssets();await wait(()=>host.querySelectorAll('.bis-asset-row').length===24&&!host.querySelector('.bis-pending-dialog'));};
document.getElementById('list')!.onclick=()=>void showList();
document.getElementById('short')!.onclick=()=>{const short=host.style.height==='360px';host.style.width=short?'360px':'280px';host.style.height=short?'640px':'360px';};
document.getElementById('run')!.onclick=async()=>{
  result.textContent='Running';
  try {
    await context.ready();context.openAccountDialog();await tick();
    const menu=[...host.querySelectorAll('button')].map(b=>b.textContent);check(menu.indexOf('Assets')===menu.indexOf('Transactions')+1,'menu order');
    const before=reads;await showList();check(reads===before+1,'one entry read');
    const list=host.querySelector<HTMLElement>('.bis-asset-list')!;check(list.scrollHeight>list.clientHeight,'list scrolls');
    list.scrollTop=450;const offset=list.scrollTop;
    const target=host.querySelectorAll<HTMLButtonElement>('.bis-asset-row')[8];target.click();await wait(()=>host.querySelector('h2')?.textContent==='Asset Detail'&&!host.querySelector('.bis-pending-dialog'));
    check(document.activeElement===host.querySelector('h2'),'detail heading focus');
    const detailContent=host.querySelector<HTMLElement>('.bis-assets-content')!;
    check(detailContent.scrollHeight<=detailContent.clientHeight,'standard asset detail fits without vertical scrolling');
    const detailCard=host.querySelector<HTMLElement>('.bis-card')!;
    check(detailCard.scrollHeight<=detailCard.clientHeight,'standard detail card has no outer scrolling');
    check(!host.querySelector('.bis-asset-metadata'),'metadata section removed');
    const burnRect=button('Burn').getBoundingClientRect(), backBounds=button('Back').getBoundingClientRect();
    check(Math.abs(burnRect.width-backBounds.width)<1&&burnRect.bottom<=backBounds.top,'full-width Burn above Back');
    check(!!host.querySelector('.bis-asset-detail')?.firstElementChild?.querySelector('[aria-label="Copy Details"]'),'Details first below Account ID');
    check(host.querySelectorAll('button').length===6,'refresh/copy/details/explorer/burn/back actions');
    const originalOpen=window.open;
    let opened:unknown[]=[];
    try {
      window.open=(...args)=>{opened=args;return null;};
      button('Open On Explorer').click();
      check(opened[0]===`https://explorer.signet.arkade.sh/asset/${rows[8].assetId}`&&opened[1]==='_blank'&&opened[2]==='noopener,noreferrer','explorer opens selected asset safely in a new tab');
    } finally {window.open=originalOpen;}
    check(host.querySelector<HTMLImageElement>('.bis-asset-summary img')?.src===iconUrl,'detail uses metadata icon URL');
    check(host.querySelector<HTMLInputElement>('.bis-asset-id input')?.value===rows[8].assetId,'single-line full ID');
    button('Copy Asset ID').click();await tick();check(copied===rows[8].assetId,'full ID copied');
    button('Copy Details').click();await tick();check(copied===formatAssetDetail(rows[8]),'metadata details copied');
    button('Back').click();await wait(()=>host.querySelectorAll('.bis-asset-row').length===24);await new Promise(requestAnimationFrame);
    check(host.querySelector('.bis-asset-list')!.scrollTop===offset,'Back retains scroll');await wait(()=>document.activeElement===host.querySelectorAll('.bis-asset-row')[8]);check(reads===before+1,'Back does not read');
    host.querySelector<HTMLButtonElement>('.bis-asset-row')!.click();await tick();copyMode='fail';button('Copy Details').click();await wait(()=>!!host.querySelector('.bis-asset-manual'));check(host.querySelector<HTMLTextAreaElement>('.bis-asset-manual')!.value===formatAssetDetail(rows[0]),'manual fallback exact');
    copyMode='pending';button('Copy Details').click();await tick();button('Back').click();await tick();host.querySelectorAll<HTMLButtonElement>('.bis-asset-row')[1].click();await tick();finishCopy?.();await tick();check(button('Copy Details').title==='Copy Details','late copy ignored');copyMode='success';
    mode='pending';void context.refreshAssets();await tick();check(!host.querySelector('.bis-asset-quantity'),'old quantity hidden during refresh');check(button('Refresh Asset Detail').disabled,'loading disables refresh');
    data=rows.map((r,i)=>i===1?{...r,quantity:'12345',decimals:2}:r);resolveRead?.(data);await wait(()=>host.querySelector('.bis-asset-quantity')?.textContent==='123.45 LVL1');
    mode='fail';await context.refreshAssets();await tick();check(host.querySelector('h2')?.textContent==='Asset Detail','failure retains detail title');check(!host.querySelector('.bis-asset-quantity'),'failure clears data');check(host.querySelector('.bis-pending-dialog')?.textContent?.includes('Assets could not be loaded'),'failure message');
    mode='ready';button('OK').click();await wait(()=>!host.querySelector('.bis-pending-dialog')&&host.querySelectorAll('.bis-asset-row').length===24);host.querySelectorAll<HTMLButtonElement>('.bis-asset-row')[1].click();await tick();
    data=rows.filter((_,i)=>i!==1);await context.refreshAssets();await wait(()=>host.querySelector('h2')?.textContent==='Assets');check(host.textContent?.includes('Asset is no longer'),'removed notice');await new Promise(requestAnimationFrame);check(document.activeElement===host.querySelector('h2'),'removed asset heading focus');
    data=[];await context.refreshAssets();await tick();check(host.textContent?.includes('No assets found.'),'empty message');
    data=[rows[22],{...rows[23],name:'<img src=x onerror=alert(1)>'}];await context.refreshAssets();await tick();check(host.textContent?.includes('1 base units'),'missing decimals base units');host.querySelector<HTMLButtonElement>('.bis-asset-row')!.click();await tick();button('Copy Details').click();await tick();check(copied.includes('Decimals: Not provided'),'missing fields copied');check(!host.querySelector('img'),'invalid URL falls back to local artwork');
    button('Back').click();await tick();button('Back').click();await tick();button('Transactions').click();await wait(()=>!!host.querySelector('.bis-transaction-row'));check(host.querySelector('h2')?.textContent==='Transactions','Transactions heading');host.querySelector<HTMLButtonElement>('.bis-transaction-row')!.click();await wait(()=>host.querySelector('h2')?.textContent==='Transaction Detail');button('Back').click();await tick();button('Back').click();await tick();
    await showList();const state=context.getState();await context.listAssets();check(context.getState()===state,'headless listing leaves runtime unchanged');
    host.style.width='280px';host.style.height='360px';await tick();host.querySelectorAll<HTMLButtonElement>('.bis-asset-row')[23].click();await tick();check(host.scrollWidth<=host.clientWidth,'narrow host has no horizontal overflow');
    const card=host.querySelector<HTMLElement>('.bis-card')!;check(card.scrollWidth<=card.clientWidth,'long metadata fits card');const backRect=button('Back').getBoundingClientRect(),hostRect=host.getBoundingClientRect();check(backRect.bottom<=hostRect.bottom,'Back remains reachable in short host');
    ui.unmount();check(context.getState().assets.status==='idle','unmount clears presentation');ui.mount(host);context.openAccountAssets();await wait(()=>context.getState().assets.status==='ready');await tick();check(context.getState().accountAssets,'late unmount cleanup preserves newly opened session');host.style.width='360px';host.style.height='640px';await showList();
    await wait(()=>host.querySelector<HTMLImageElement>('.bis-asset-row img')?.src===iconUrl);
    host.querySelector<HTMLButtonElement>('.bis-asset-row')!.click();await tick();
    const beforeBurns=burns;button('Burn').click();await wait(()=>!!host.querySelector('dialog[open]'));
    check(host.querySelector('dialog h2')?.textContent==='Confirmation'&&host.querySelector('dialog p')?.textContent==='Are you sure?','exact reusable confirmation text');
    check(document.activeElement===button('Cancel'),'Cancel initially focused');check(burns===beforeBurns,'opening confirmation does not burn');button('Cancel').click();await tick();check(burns===beforeBurns&&!host.querySelector('dialog'),'Cancel does not burn');
    button('Burn').click();await wait(()=>!!host.querySelector('dialog[open]'));host.querySelector('dialog')!.dispatchEvent(new Event('cancel',{cancelable:true}));await tick();check(burns===beforeBurns&&!host.querySelector('dialog'),'Escape cancellation does not burn');
    button('Burn').click();await wait(()=>!!host.querySelector('dialog[open]'));const ok=button('OK');ok.click();ok.click();await wait(()=>burns===beforeBurns+1);
    check(button('Burn').disabled&&button('Back').disabled&&button('Refresh Asset Detail').disabled,'busy actions disabled');finishBurn?.(false);await wait(()=>host.textContent?.includes('Fixture burn unavailable.')===true);check(!!host.querySelector('.bis-pending-dialog'),'failed burn stays covered');button('OK').click();await wait(()=>!host.querySelector('.bis-pending-dialog'));host.querySelector<HTMLButtonElement>('.bis-asset-row')!.click();await tick();
    button('Burn').click();await wait(()=>!!host.querySelector('dialog[open]'));button('OK').click();await wait(()=>burns===beforeBurns+2);finishBurn?.(true);await wait(()=>host.querySelectorAll('.bis-asset-row').length===23);check(!host.textContent?.includes('Asset burned.')&&!host.querySelector('.bis-pending-dialog'),'success reveals refreshed list without completion banner');
    result.textContent='PASS: exact amounts, row/detail icons, single-line ID and metadata copy, clipboard failure/race, refresh states, safe metadata fallback, navigation/focus/scroll, narrow layout, confirmation Cancel/Escape, single burn after OK, busy state, failed burn and success refresh. Fixtures only; no live asset burned.';
  } catch(error) {result.textContent='FAIL: '+(error instanceof Error?error.message:'checks');}
};
window.addEventListener('pagehide',()=>{ui.unmount();context.dispose();if(originalClipboard)Object.defineProperty(navigator,'clipboard',originalClipboard);else Reflect.deleteProperty(navigator,'clipboard');});
