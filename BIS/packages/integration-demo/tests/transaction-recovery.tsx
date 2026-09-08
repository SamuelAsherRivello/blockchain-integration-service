import {createContext} from '../../integration/src/core/context';
import {createBisUi} from '../../integration/src/ui/client';
import type {WalletOperation} from '../../integration/src/core/activity-operations';
import type {BisTransaction} from '../../integration/src/core/activity';
const account={profileId:'isolated-recovery',phrase:'fixture-only'};
let operations: WalletOperation[]=[
  {id:'send:one',transactionId:'a'.repeat(64),amountSats:1000,inputsKnown:true,canDiscard:false,reservedInputSats:2000},
  {id:'transfer:draft',amountSats:2000,inputsKnown:true,canDiscard:true,direction:'Bitcoin → Arkade'},
  {id:'burn:unknown',inputsKnown:false,canDiscard:false},
];
let rows: readonly BisTransaction[]=[{id:'sdk-send',identifier:`ark:${'a'.repeat(64)}`,amountSats:1000,direction:'Outgoing',status:'Pending offchain'}];
let checks=0;
const context=createContext({load:async()=>({account,generation:0}),save:async()=>{},reset:async()=>{},subscribe:()=>()=>{}},undefined,async()=>account.profileId,undefined,undefined,undefined,undefined,
  async(_,signal,publish)=>{publish(rows);await new Promise<void>(resolve=>signal.addEventListener('abort',()=>resolve(),{once:true}));});
context.getWalletOperations=async()=>({operations,availableSats:3000,totalSats:10000,reservedInputSats:7000});
context.checkAccountSend=async()=>{checks++;return {status:'pending',verification:'unavailable'};};
context.discardPreparedTransfer=async id=>{if(id!=='draft')throw Error('Wrong draft');operations=operations.filter(op=>op.id!==`transfer:${id}`);};
const ui=createBisUi(context);ui.mount(document.getElementById('host')!);
await context.ready();context.openAccountDialog();
Object.assign(window,{recoveryFixture:{get checks(){return checks;},settle(){operations=[];rows=[{...rows[0],status:'Settled offchain'}];void context.refreshActivity();}}});
