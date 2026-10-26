import {createHash,createHmac,timingSafeEqual} from 'node:crypto';
import type {DerivedTreasureGameActorAuthorization} from './treasure-actor-authorization.ts';

export type TreasureActorAuthority='public'|'owner';
export type TreasureActorBinding=Readonly<{
  audience:string;gameId:string;network:'mutinynet';profileId:string;operationId:string;connectionId:string;playerPublicKey:string;authority:TreasureActorAuthority;
}>;
type ActorPlan=TreasureActorBinding&Readonly<{
  purpose:'bis-treasure-actor-plan-v1';requestDigest:string;message:string;gamePublicKey:string;
  branch:'reject'|'cancel'|'refund';funding:Readonly<{txid:string;vout:number}>;
  checkpointId:string;templateRootId:string;observedAtMs:number;deadlineMs:number;expires:number;
}>;
type ActorGrant=TreasureActorBinding&Readonly<{
  purpose:'bis-treasure-actor-grant-v1';planDigest:string;requestDigest:string;expires:number;
}>;
const deny=()=>Error('Treasure Game actor authorization is outside the signing policy.');
const same=(left:unknown,right:unknown)=>{
  if(!left||typeof left!=='object'||Array.isArray(left))return false;
  return Object.entries(right as Record<string,unknown>).every(([key,value])=>Reflect.get(left,key)===value);
};
const mac=(secret:string,domain:string,value:string)=>createHmac('sha256',secret).update(`${domain}:${value}`).digest();
function seal<T>(secret:string,domain:string,value:T){
  const encoded=Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encoded}.${mac(secret,domain,encoded).toString('base64url')}`;
}
function open<T>(secret:string,domain:string,token:unknown):T{
  if(typeof token!=='string'||token.length>8192)throw deny();
  const parts=token.split('.');if(parts.length!==2)throw deny();
  const expected=mac(secret,domain,parts[0]),actual=Buffer.from(parts[1],'base64url');
  if(actual.length!==expected.length||!timingSafeEqual(actual,expected))throw deny();
  const value:unknown=JSON.parse(Buffer.from(parts[0],'base64url').toString('utf8'));
  if(!value||typeof value!=='object'||Array.isArray(value))throw deny();
  return value as T;
}
function validBinding(value:TreasureActorBinding){
  const keys=['audience','gameId','network','profileId','operationId','connectionId','playerPublicKey','authority'];
  let audience:URL;
  try{audience=new URL(value.audience);}catch{throw deny();}
  if(!value||typeof value!=='object'||Array.isArray(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value))||
    Object.keys(value).sort().join(',')!==keys.sort().join(',')||!['public','owner'].includes(value.authority)||value.network!=='mutinynet'||
    audience.protocol!=='https:'||audience.origin!==value.audience||! /^[a-zA-Z0-9-]{1,100}$/.test(value.gameId)||
    !/^[a-f0-9]{64}$/.test(value.profileId)||! /^0[23][a-f0-9]{64}$/.test(value.playerPublicKey)||! /^[a-z0-9-]{1,100}$/i.test(value.operationId)||
    !/^[a-f0-9-]{36}$/.test(value.connectionId))throw deny();
}
function validPlan(value:ActorPlan,binding:TreasureActorBinding,requestDigest:string,now:number){
  const keys=['audience','gameId','network','profileId','operationId','connectionId','playerPublicKey','authority','purpose','requestDigest','message','gamePublicKey','branch','funding','checkpointId','templateRootId','observedAtMs','deadlineMs','expires'];
  if(!value||typeof value!=='object'||Object.keys(value).sort().join(',')!==keys.sort().join(',')||!same(value,binding)||
    value.purpose!=='bis-treasure-actor-plan-v1'||value.requestDigest!==requestDigest||! /^[a-f0-9]{64}$/.test(value.requestDigest)||
    !/^[a-f0-9]{64}$/.test(value.message)||!/^0[23][a-f0-9]{64}$/.test(value.gamePublicKey)||
    !['reject','cancel','refund'].includes(value.branch)||!value.funding||typeof value.funding!=='object'||Array.isArray(value.funding)||
    Object.getPrototypeOf(value.funding)!==Object.prototype||Object.keys(value.funding).sort().join(',')!=='txid,vout'||! /^[a-f0-9]{64}$/.test(value.funding.txid)||
    !Number.isSafeInteger(value.funding.vout)||value.funding.vout<0||value.funding.vout>0xffffffff||
    !/^[a-f0-9]{64}$/.test(value.checkpointId)||! /^[a-f0-9]{64}$/.test(value.templateRootId)||
    !Number.isSafeInteger(value.observedAtMs)||!Number.isSafeInteger(value.deadlineMs)||value.observedAtMs>now||
    !Number.isSafeInteger(value.expires)||value.expires<=now||value.expires>now+60_000||
    value.branch!=='refund'&&value.expires>value.deadlineMs||
    value.branch==='refund'&&value.observedAtMs<value.deadlineMs||value.branch!=='refund'&&value.observedAtMs>=value.deadlineMs)throw deny();
}
function equalsDerived(plan:ActorPlan,derived:DerivedTreasureGameActorAuthorization){
  return plan.branch===derived.branch&&plan.operationId===derived.operationId&&plan.gamePublicKey===derived.gamePublicKey&&
    plan.funding.txid===derived.funding.txid&&plan.funding.vout===derived.funding.vout&&plan.checkpointId===derived.checkpointId&&
    plan.templateRootId===derived.templateRootId&&plan.message===Buffer.from(derived.message).toString('hex')&&
    derived.observedAtMs>=plan.observedAtMs&&plan.deadlineMs===derived.deadlineMs;
}
function validGrant(grant:ActorGrant,planToken:string,binding:TreasureActorBinding,requestDigest:string,now:number,allowExpired:boolean){
  const keys=['audience','gameId','network','profileId','operationId','connectionId','playerPublicKey','authority','purpose','planDigest','requestDigest','expires'];
  if(Object.keys(grant).sort().join(',')!==keys.sort().join(',')||!same(grant,binding)||grant.purpose!=='bis-treasure-actor-grant-v1'||
    grant.requestDigest!==requestDigest||grant.planDigest!==createHash('sha256').update(planToken).digest('hex')||
    !Number.isSafeInteger(grant.expires)||grant.expires>now+60_000||!allowExpired&&grant.expires<=now)throw deny();
}
export function createTreasureActorPlanAuthorization(secret:string|undefined,now=Date.now){
  const configured=typeof secret==='string'&&secret.length>=32;
  const requireSecret=()=>{if(!configured)throw deny();return secret!;};
  return {
    authority(token:string):TreasureActorAuthority{
      const key=requireSecret();
      for(const authority of ['public','owner'] as const){
        try{
          const plan=open<ActorPlan>(key,`bis-treasure-actor-plan-${authority}-v1`,token);
          if(plan.authority===authority&&plan.purpose==='bis-treasure-actor-plan-v1')return authority;
        }catch{/* Try the separate owner domain. */}
      }
      throw deny();
    },
    playerKey(token:string):string{
      const authority=this.authority(token),plan=open<ActorPlan>(requireSecret(),`bis-treasure-actor-plan-${authority}-v1`,token);
      if(!/^0[23][a-f0-9]{64}$/.test(plan.playerPublicKey))throw deny();return plan.playerPublicKey;
    },
    plan(binding:TreasureActorBinding,requestDigest:string,derived:DerivedTreasureGameActorAuthorization){
      validBinding(binding);const time=now();
      if(!/^[a-f0-9]{64}$/.test(requestDigest)||!Number.isSafeInteger(time)||derived.observedAtMs>time||
        derived.branch==='refund'&&time<derived.deadlineMs||derived.branch!=='refund'&&time>=derived.deadlineMs)throw deny();
      const plan:ActorPlan={...binding,purpose:'bis-treasure-actor-plan-v1',requestDigest,message:Buffer.from(derived.message).toString('hex'),
        gamePublicKey:derived.gamePublicKey,branch:derived.branch,funding:{...derived.funding},checkpointId:derived.checkpointId,
        templateRootId:derived.templateRootId,observedAtMs:derived.observedAtMs,deadlineMs:derived.deadlineMs,
        expires:derived.branch==='refund'?time+60_000:Math.min(time+60_000,derived.deadlineMs)};
      return seal(requireSecret(),`bis-treasure-actor-plan-${binding.authority}-v1`,plan);
    },
    authorize(token:string,binding:TreasureActorBinding,requestDigest:string,derived:DerivedTreasureGameActorAuthorization){
      validBinding(binding);const plan=open<ActorPlan>(requireSecret(),`bis-treasure-actor-plan-${binding.authority}-v1`,token),time=now();
      validPlan(plan,binding,requestDigest,time);if(!equalsDerived(plan,derived))throw deny();
      const grant:ActorGrant={...binding,purpose:'bis-treasure-actor-grant-v1',planDigest:createHash('sha256').update(token).digest('hex'),requestDigest,
        expires:Math.min(plan.expires,time+60_000)};
      return seal(requireSecret(),`bis-treasure-actor-grant-${binding.authority}-v1`,grant);
    },
    verify(token:string,grantToken:string,binding:TreasureActorBinding,requestDigest:string,derived:DerivedTreasureGameActorAuthorization){
      validBinding(binding);const key=requireSecret(),plan=open<ActorPlan>(key,`bis-treasure-actor-plan-${binding.authority}-v1`,token),time=now();
      validPlan(plan,binding,requestDigest,time);if(!equalsDerived(plan,derived))throw deny();
      const grant=open<ActorGrant>(key,`bis-treasure-actor-grant-${binding.authority}-v1`,grantToken);
      validGrant(grant,token,binding,requestDigest,time,false);if(grant.expires>plan.expires)throw deny();
      return plan;
    },
    verifyReplay(token:string,grantToken:string,binding:TreasureActorBinding,requestDigest:string){
      validBinding(binding);const key=requireSecret(),plan=open<ActorPlan>(key,`bis-treasure-actor-plan-${binding.authority}-v1`,token);
      const keys=['audience','gameId','network','profileId','operationId','connectionId','playerPublicKey','authority','purpose','requestDigest','message','gamePublicKey','branch','funding','checkpointId','templateRootId','observedAtMs','deadlineMs','expires'];
      if(Object.keys(plan).sort().join(',')!==keys.sort().join(',')||!same(plan,binding)||plan.purpose!=='bis-treasure-actor-plan-v1'||
        plan.requestDigest!==requestDigest||! /^[a-f0-9]{64}$/.test(plan.requestDigest)||! /^[a-f0-9]{64}$/.test(plan.message)||
        !/^0[23][a-f0-9]{64}$/.test(plan.gamePublicKey)||!['reject','cancel','refund'].includes(plan.branch)||
        !plan.funding||typeof plan.funding!=='object'||Array.isArray(plan.funding)||Object.keys(plan.funding).sort().join(',')!=='txid,vout'||
        !/^[a-f0-9]{64}$/.test(plan.funding.txid)||!Number.isSafeInteger(plan.funding.vout)||
        !/^[a-f0-9]{64}$/.test(plan.checkpointId)||! /^[a-f0-9]{64}$/.test(plan.templateRootId)||
        !Number.isSafeInteger(plan.observedAtMs)||!Number.isSafeInteger(plan.deadlineMs)||!Number.isSafeInteger(plan.expires))throw deny();
      const grant=open<ActorGrant>(key,`bis-treasure-actor-grant-${binding.authority}-v1`,grantToken);
      validGrant(grant,token,binding,requestDigest,now(),true);if(grant.expires>plan.expires)throw deny();return plan;
    },
    /** A sealed V1 actor plan plus the exact request is a narrowly scoped
     * capability to read an already completed result. No grant is minted or
     * required, and this method never authorizes a new signature. */
    recoverCompleted(token:string,binding:TreasureActorBinding,requestDigest:string){
      validBinding(binding);const key=requireSecret(),plan=open<ActorPlan>(key,`bis-treasure-actor-plan-${binding.authority}-v1`,token),time=now();
      const keys=['audience','gameId','network','profileId','operationId','connectionId','playerPublicKey','authority','purpose','requestDigest','message','gamePublicKey','branch','funding','checkpointId','templateRootId','observedAtMs','deadlineMs','expires'];
      if(Object.keys(plan).sort().join(',')!==keys.sort().join(',')||!same(plan,binding)||plan.purpose!=='bis-treasure-actor-plan-v1'||
        plan.requestDigest!==requestDigest||! /^[a-f0-9]{64}$/.test(plan.requestDigest)||! /^[a-f0-9]{64}$/.test(plan.message)||
        !/^0[23][a-f0-9]{64}$/.test(plan.gamePublicKey)||!['reject','cancel','refund'].includes(plan.branch)||
        !plan.funding||typeof plan.funding!=='object'||Array.isArray(plan.funding)||Object.getPrototypeOf(plan.funding)!==Object.prototype||
        Object.keys(plan.funding).sort().join(',')!=='txid,vout'||! /^[a-f0-9]{64}$/.test(plan.funding.txid)||
        !Number.isSafeInteger(plan.funding.vout)||plan.funding.vout<0||plan.funding.vout>0xffffffff||
        !/^[a-f0-9]{64}$/.test(plan.checkpointId)||! /^[a-f0-9]{64}$/.test(plan.templateRootId)||
        !Number.isSafeInteger(plan.observedAtMs)||plan.observedAtMs>time||!Number.isSafeInteger(plan.deadlineMs)||
        !Number.isSafeInteger(plan.expires)||plan.expires<=0||plan.expires>time+60_000||
        plan.branch!=='refund'&&plan.expires>plan.deadlineMs||plan.branch==='refund'&&plan.observedAtMs<plan.deadlineMs||
        plan.branch!=='refund'&&plan.observedAtMs>=plan.deadlineMs)throw deny();
      return plan;
    },
  };
}
