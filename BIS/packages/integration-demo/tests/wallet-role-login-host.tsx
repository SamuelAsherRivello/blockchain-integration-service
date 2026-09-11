import { createRoot } from 'react-dom/client';
import { createContext } from '../../integration/src/core/context';
import { createBisGameWallet } from '../../integration/src/core/game-wallet';
import { createBisUi } from '@bis/integration';
import { GameWalletLogin } from '../../integration/src/ui/GameWalletLogin';
import '@bis/integration/style.css';

const result=document.getElementById('result')!;
const playerFirst=document.getElementById('player-first')!;
const gameFirst=document.getElementById('game-first')!;
const tick=()=>new Promise(resolve=>setTimeout(resolve,30));
const check=(value:unknown,message:string)=>{if(!value)throw Error(message);};
const phrase='abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const button=(root:HTMLElement,name:string)=>[...root.querySelectorAll('button')].find(item=>item.textContent?.trim()===name||item.getAttribute('aria-label')===name)!;
const frame=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
function accountStorage(account:{profileId:string;phrase:string}|null) {
  let active=account;
  return {load:async()=>({generation:0,account:active}),save:async(next:{profileId:string;phrase:string})=>{active=next;},reset:async()=>{active=null;},subscribe:()=>()=>{}};
}
function walletDependencies() {
  let selected:{profileId:string;phrase:string}|null=null;
  return {storage:{load:async()=>selected,select:async(account:{profileId:string;phrase:string})=>{selected=account;},logout:async()=>{selected=null;},subscribe:()=>()=>{},dispose:()=>{}},restore:async()=>({profileId:'player-fixture',phrase:'fixture only'}),addresses:async()=>({arkadeAddress:'tark1fixture',bitcoinAddress:'tb1fixture'}),balance:async()=>({availableSats:0,totalSats:0,bitcoinSats:0,arkadeSats:0}),watch:undefined};
}

document.getElementById('run')!.onclick=async()=>{
  result.textContent='Running';playerFirst.replaceChildren();gameFirst.replaceChildren();
  try {
    const player=createContext(accountStorage({profileId:'player-fixture',phrase:'fixture only'}),undefined,async()=> 'player-fixture');
    await player.ready();
    const playerFirstWallet=createBisGameWallet({playerProfileId:()=>player.getState().profileId},walletDependencies());
    const playerRoot=createRoot(playerFirst);
    playerRoot.render(<div className="bis-layer bis-layer-open"><section className="bis-card"><GameWalletLogin wallet={playerFirstWallet} onBack={()=>undefined}/></section></div>);
    await frame();
    Object.defineProperty(navigator,'clipboard',{configurable:true,value:{readText:async()=>phrase}});
    button(playerFirst,'⚡ Restore Game Wallet').click();await frame();button(playerFirst,'Paste from Clipboard').click();await frame();
    check(!button(playerFirst,'⚡ Restore Game Wallet').disabled,'Player-first restore is not enabled');button(playerFirst,'⚡ Restore Game Wallet').click();await tick();
    check(playerFirst.textContent?.includes('belongs to the player wallet'),'Player-first conflict is not visible');
    check(player.getState().profileId==='player-fixture'&&!playerFirstWallet.getState().profileId,'Player-first conflict changed a role');

    let gameWallet:ReturnType<typeof createBisGameWallet>;
    const gameFirstPlayer=createContext(accountStorage(null),async()=>({profileId:'game-fixture',phrase:'fixture only'}),async()=> 'game-fixture',undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,{gameWalletProfileId:()=>gameWallet?.getState().profileId});
    gameWallet=createBisGameWallet({playerProfileId:()=>gameFirstPlayer.getState().profileId},walletDependencies());
    await gameWallet.selectWallet({profileId:'game-fixture',phrase:'fixture only'});await gameFirstPlayer.ready();
    const playerUi=createBisUi(gameFirstPlayer);playerUi.mount(gameFirst);gameFirstPlayer.openAccountDialog();await gameFirstPlayer.createAccount();await gameFirstPlayer.continueAccount();await tick();
    check(gameFirst.textContent?.includes('already configured as the Game Wallet'),'Game-first conflict is not visible');
    check(!gameFirstPlayer.getState().hasProfile&&gameWallet.getState().profileId==='game-fixture','Game-first conflict changed a role');
    playerUi.unmount();gameFirstPlayer.dispose();gameWallet.dispose();playerRoot.unmount();player.dispose();playerFirstWallet.dispose();
    result.textContent='PASS: Player-first and Game-Wallet-first same-identity logins are rejected without role replacement.';
  } catch(error) {result.textContent=`FAIL: ${error instanceof Error?error.message:'wallet role login checks'}`;}
};
