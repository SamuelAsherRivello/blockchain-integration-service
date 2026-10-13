import assert from 'node:assert/strict';
import test from 'node:test';
import { createWalletSessionPublisher, isWalletSessionNotification, listenForWalletSessionNotifications, publishWalletSessionLifecycle } from '../../src/client/integration-layer/wallet-session-notifications.ts';

function fixture() {
  const listeners = new Set<(event: MessageEvent<unknown>) => void>();
  const host = {addEventListener(_type:string, listener:EventListener){listeners.add(listener as unknown as (event:MessageEvent<unknown>)=>void);},removeEventListener(_type:string, listener:EventListener){listeners.delete(listener as unknown as (event:MessageEvent<unknown>)=>void);}};
  const sent: unknown[] = [];
  const peer = {origin:'https://biz.example',window:{postMessage(value:unknown, origin:string){sent.push({value,origin});}} as unknown as Window};
  return {host,peer,sent,emit(event:Partial<MessageEvent<unknown>>){for(const listener of listeners)listener(event as MessageEvent<unknown>);}};
}

test('wallet lifecycle publisher sends public active and inactive role evidence only', () => {
  const f=fixture(),publisher=createWalletSessionPublisher(f.peer);
  const active=publisher.publish('player',{profileId:'player-id',network:'signet',address:'tark1player'}),inactive=publisher.publish('player',{});
  assert.deepEqual(active,{type:'bis.wallet-session',version:1,role:'player',active:true,revision:1,profileId:'player-id',network:'signet',address:'tark1player'});
  assert.deepEqual(inactive,{type:'bis.wallet-session',version:1,role:'player',active:false,revision:2});
  assert.equal(JSON.stringify(f.sent).match(/phrase|private|secret|balance|transaction/i),null);
});

test('wallet lifecycle listener accepts only newer messages from its exact trusted peer', () => {
  const f=fixture(),received:unknown[]=[];
  const stop=listenForWalletSessionNotifications(f.peer,event=>received.push(event),f.host);
  const active={type:'bis.wallet-session',version:1,role:'game',active:true,revision:2,profileId:'game-id',network:'signet',address:'tark1game'};
  f.emit({origin:'https://evil.example',source:f.peer.window,data:active});
  f.emit({origin:'https://biz.example',source:{} as Window,data:active});
  f.emit({origin:'https://biz.example',source:f.peer.window,data:{...active,revision:0}});
  f.emit({origin:'https://biz.example',source:f.peer.window,data:active});
  f.emit({origin:'https://biz.example',source:f.peer.window,data:active});
  f.emit({origin:'https://biz.example',source:f.peer.window,data:{type:'bis.wallet-session',version:1,role:'game',active:false,revision:3}});
  assert.deepEqual(received,[active,{type:'bis.wallet-session',version:1,role:'game',active:false,revision:3}]);
  stop();
});

test('lifecycle publisher subscribes both roles and publishes inactive state during intentional disposal', () => {
  const f=fixture();let player={profileId:'player',network:'signet' as const,address:'tark1player'},game={profileId:'game',network:'signet' as const,address:'tark1game'};const playerListeners=new Set<()=>void>(),gameListeners=new Set<()=>void>();
  const lifecycle=publishWalletSessionLifecycle(f.peer,{getState:()=>player,subscribe:l=>{playerListeners.add(l);return()=>playerListeners.delete(l);}},{getState:()=>game,subscribe:l=>{gameListeners.add(l);return()=>gameListeners.delete(l);}});
  player={};for(const listener of playerListeners)listener();lifecycle.dispose({publishInactive:true});
  assert.equal(f.sent.length,5);assert.equal(isWalletSessionNotification((f.sent[0] as {value:unknown}).value),true);assert.equal(isWalletSessionNotification((f.sent[4] as {value:unknown}).value),true);
});
