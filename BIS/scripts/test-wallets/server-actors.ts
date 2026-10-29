import {createHash} from 'node:crypto';
// The existing command helpers are legacy untyped modules. Keep that boundary
// dynamic while typechecking this public-reference schema and its callers.
const legacy=(path:string)=>import(new URL(path,import.meta.url).href);
const {label,network}=await legacy('./arguments.ts');
const {fail}=await legacy('./errors.ts');

export type PublicServerSource=Readonly<{endpoint:string;publicKey:string}>;
type TestActor={label:string;profileId:string;generation:number;network?:'signet'|'mutinynet';grant?:{active:boolean;networks:string[];source?:string};reportedPending?:Record<string,unknown>;server?:{endpoint:string;publicKey:string;gameId:string};phrase?:string};
type ActorState={accounts:TestActor[];serverActors?:unknown};
type PublicServerActor=PublicServerSource&{network:'signet'|'mutinynet';profileId:string;grant:{active:boolean;networks:string[];source:string}};
function reject(code:string):never{return fail(code) as never;}
const exact=(value:unknown,keys:string[]):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value)&&
  Reflect.ownKeys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));

/** A public reference has no recovery or signing material. Changing any part
 * creates a different source, even when the public key remains the same. */
export function canonicalServerSource(value:unknown,selectedNetwork:unknown,profileId:unknown):PublicServerSource {
  network(selectedNetwork);
  if(!exact(value,['endpoint','publicKey'])||typeof value.endpoint!=='string'||typeof value.publicKey!=='string'||!/^0[23][a-f0-9]{64}$/.test(value.publicKey)||
    createHash('sha256').update(Buffer.from(value.publicKey,'hex')).digest('hex')!==profileId)reject('server-actor-binding-invalid');
  let url:URL;try{url=new URL(value.endpoint);}catch{reject('server-actor-binding-invalid');}
  if(url.protocol!=='https:'||!url.hostname.endsWith('.vercel.app')||url.username||url.password||url.port||url.search||url.hash||url.pathname!=='/api/bis/'||url.href!==value.endpoint)
    fail('server-actor-binding-invalid');
  return {endpoint:value.endpoint,publicKey:value.publicKey};
}

export function validateServerActor(actor:unknown):PublicServerActor {
  if(!exact(actor,['endpoint','network','publicKey','profileId','grant'])||
    !exact(actor.grant,['active','networks','source'])||typeof actor.grant.active!=='boolean'||
    !Array.isArray(actor.grant.networks)||actor.grant.networks.length!==1||actor.grant.networks[0]!==actor.network||
    actor.grant.source!=='user-approved-hosted-test-actor')reject('server-actor-registration-invalid');
  canonicalServerSource({endpoint:actor.endpoint,publicKey:actor.publicKey},actor.network,actor.profileId);
  return actor as unknown as PublicServerActor;
}

export function publicServerActors(state:ActorState):TestActor[] {
  if(state.serverActors===undefined)return [];
  if(!state.serverActors||typeof state.serverActors!=='object'||Array.isArray(state.serverActors))reject('server-actor-registration-invalid');
  return Object.entries(state.serverActors).map(([name,value])=>{
    label(name);const actor=validateServerActor(value);
    return {label:name,profileId:actor.profileId,generation:1,network:actor.network,grant:structuredClone(actor.grant),
      server:{endpoint:actor.endpoint,publicKey:actor.publicKey,gameId:'stealth-and-steel'}};
  });
}

export function findTestActor(state:ActorState,name:string|undefined):TestActor|undefined {
  return state.accounts.find(account=>account.label===name)??publicServerActors(state).find(actor=>actor.label===name);
}

export function actorSource(actor:Pick<TestActor,'server'>):PublicServerSource|undefined {
  return actor.server?{endpoint:actor.server.endpoint,publicKey:actor.server.publicKey}:undefined;
}

export function assertAssignedServerActor(actor:TestActor|undefined,assignment:{gameProfileId:string;network:string;endpoint:string;serverPublicKey:string}) {
  if(!actor||actor.profileId!==assignment.gameProfileId)reject('server-actor-assignment-mismatch');
  if(actor.server&&(actor.network!==assignment.network||actor.server.endpoint!==assignment.endpoint||
    actor.server.publicKey!==assignment.serverPublicKey||actor.server.gameId!=='stealth-and-steel'))fail('server-actor-assignment-mismatch');
}
