import {createContext} from '../../integration/src/core/context';
import {createBisUi} from '@bis/integration';
import '@bis/integration/style.css';
const identity={phrase:Array.from({length:12},(_,i)=>`placeholder${i}`).join(' '),profileId:'fixture-public-account-0123456789'};
let stop=()=>{};
async function open(screen: 'setup'|'saved'|'restore'|'account') {
  stop(); const account=screen==='saved'||screen==='account'?identity:null;
  const context=createContext({load:async()=>({generation:0,account}),save:async()=>{},reset:async()=>{},subscribe:()=>()=>{}},async()=>identity,async()=>identity.profileId,undefined,async()=>({availableSats:0,totalSats:0,bitcoinSats:0,arkadeSats:0}));
  const ui=createBisUi(context);ui.mount(document.getElementById('host')!);stop=()=>{ui.unmount();context.dispose();};
  await context.ready();context.openAccountDialog();
  if(screen==='setup')await context.createAccount();
  if(screen==='saved')context.openAccountRecovery();
  if(screen==='restore')context.openRestoreAccount();
}
Object.assign(window,{uiFeedback:{open}});
void open('setup');
