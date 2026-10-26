import { MAX_OPERATION_EXPOSURE_SATS } from './signing-limits.ts';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { Transaction } from '@arkade-os/sdk';
import { decodeSigningValue, toHex } from '../../../integration/src/client/wallet-layer-arkade/server-wallet-protocol.ts';
import type { PlayerProofBinding } from '../../../integration/src/client/wallet-layer-arkade/player-proof-protocol.ts';
import { assertCanonicalSigningTransaction, type validateOffchainPayment } from './offchain-policy.ts';
import { signingDigest } from './signing-authorization.ts';
import {assertTreasureRawSigningValue,assertTreasureSigningTransaction,assertTreasureV4AuthorizationPair,assertTreasurePolicyObservation,assertTreasurePolicyCompletion,type TreasureSigningPolicy} from './treasure-contract-policy.ts';
import {verifyTapscriptSignatures} from '@arkade-os/sdk';
import {assertTreasureSignatureRetention} from '../../../integration/src/client/wallet-layer-arkade/treasure-psbt-equivalence.ts';

type Binding = PlayerProofBinding & { connectionId: string };
type ValidatedPlan = ReturnType<typeof validateOffchainPayment> & { issuedAssets?: string[]; assetPolicy?: boolean; receiptKeys?: string[]; contractPolicy?: boolean;treasurePolicy?:TreasureSigningPolicy };
type Plan = Binding & { playerPublicKey?: string; root: string; checkpoints: string[]; sourceOutpoints: string[]; exposureSats: number; issuedAssets?: string[]; assetPolicy?: boolean; receiptKeys?:string[]; contractPolicy?: boolean;treasurePolicy?:TreasureSigningPolicy;rootRequestId?:string;rootArgsDigest?:string; expires: number; purpose: string };
export type VerifiedTreasureCheckpoint = Readonly<{
  rootRequestId:string; rootRequestDigest:string; rootClaimDay:string; rootTransactionId:string;
  operationId:string; exposureSats:number;
  rootInputs:readonly string[]; checkpointInputs:readonly string[]; checkpointIndex:number;
  checkpointOutpoint:Readonly<{txid:string;index:number}>; parentResult:unknown; playerPublicKey?:string;
}>;
const deny = () => Error('Payment authorization required.');
const psbt = (encoded: string) => Transaction.fromPSBT(Uint8Array.from(Buffer.from(encoded, 'base64')));

/** Public transaction data only. The sealed plan stays in a JSON body, not a
 * response header or cookie. No secret keys, nonces or server workflow journal.
 */
export function createPaymentAuthorization(secret: string | undefined, now = Date.now, authority: 'player' | 'owner' = 'player') {
  const planDomain = authority === 'owner' ? 'bis-owner-plan-v1' : 'bis-payment-plan-v1';
  const grantDomain = authority === 'owner' ? 'bis-owner-plan-grant-v1' : 'bis-payment-grant-v1';
  const treasureV4PlanDomain=authority==='owner'?'bis-owner-treasure-plan-v4':'bis-payment-treasure-plan-v4';
  const treasureV4GrantDomain=authority==='owner'?'bis-owner-treasure-plan-grant-v4':'bis-payment-treasure-plan-grant-v4';
  const configured = typeof secret === 'string' && secret.length >= 32;
  const mac = (domain: string, value: string) => {
    if (!configured) throw deny();
    return createHmac('sha256', secret!).update(`${domain}:${value}`).digest();
  };
  const seal = (domain: string, body: unknown) => {
    const value = Buffer.from(JSON.stringify(body)).toString('base64url');
    return `${value}.${mac(domain, value).toString('base64url')}`;
  };
  const open = (domain: string, token: string, limit: number) => {
    if (typeof token !== 'string' || token.length > limit) throw deny();
    const parts = token.split('.');
    if (parts.length !== 2) throw deny();
    const actual = Buffer.from(parts[1], 'base64url'), expected = mac(domain, parts[0]);
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw deny();
    return JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
  };
  const planTokenDomain=(token:string)=>{
    if(typeof token!=='string'||token.length>1024*1024)throw deny();
    const payload=token.split('.')[0];if(!payload||payload.length>1024*1024)throw deny();
    let body:any;try{body=JSON.parse(Buffer.from(payload,'base64url').toString('utf8'));}catch{throw deny();}
    return body?.treasurePolicy?.artifactVersion===4?treasureV4PlanDomain:planDomain;
  };
  const scoped = (scope: Binding & { expires: number }, binding: Binding, lifetime: number, allowExpiredForCompletedRead = false) => {
    if (!Number.isSafeInteger(scope.expires) || scope.expires <= 0 || !allowExpiredForCompletedRead && scope.expires <= now() || scope.expires > now() + lifetime || Object.entries(binding).some(([key, value]) => Reflect.get(scope, key) !== value)) throw deny();
  };
  const readPlan = (token: string, binding: Binding, allowExpiredForCompletedRead = false): Plan => {
    const domain=planTokenDomain(token),plan = open(domain, token, domain===treasureV4PlanDomain?1024*1024:512*1024) as Plan;
    scoped(plan, binding, 600000, allowExpiredForCompletedRead);
    const expectedDomain=plan.treasurePolicy?.artifactVersion===4?treasureV4PlanDomain:planDomain;
    if (domain!==expectedDomain||plan.purpose!==expectedDomain || (authority === 'player' ? !/^0[23][a-f0-9]{64}$/.test(plan.playerPublicKey ?? '') : plan.playerPublicKey !== undefined) || !Number.isSafeInteger(plan.exposureSats) || plan.exposureSats < 0 || plan.exposureSats > MAX_OPERATION_EXPOSURE_SATS || !Array.isArray(plan.checkpoints) || plan.checkpoints.length === 0 || plan.checkpoints.length > 100 || !Array.isArray(plan.sourceOutpoints) || plan.sourceOutpoints.length !== plan.checkpoints.length) throw deny();
    if (plan.issuedAssets !== undefined && (!Array.isArray(plan.issuedAssets) || plan.issuedAssets.length !== 1 || !/^[a-f0-9]{68}$/.test(plan.issuedAssets[0]))) throw deny();
    if(plan.receiptKeys!==undefined&&(authority!=='player'||!Array.isArray(plan.receiptKeys)||plan.receiptKeys.length!==1||!/^marketplace-payment:[a-f0-9]{64}:0$/.test(plan.receiptKeys[0])))throw deny();
    if (plan.contractPolicy !== undefined && plan.contractPolicy !== true) throw deny();
    if(plan.treasurePolicy!==undefined){
      const policy=plan.treasurePolicy;
      if(![3,4].includes(policy.artifactVersion)||policy.intent.artifactVersion!==policy.artifactVersion||plan.network!=='mutinynet'||!plan.contractPolicy||
        (policy.intent.kind==='fund')!==(policy.intent.branch==='fund')||
        typeof plan.rootRequestId!=='string'||!/^[a-z0-9-]{1,100}$/i.test(plan.rootRequestId)||!/^[a-f0-9]{64}$/.test(plan.rootArgsDigest??''))throw deny();
      if(policy.artifactVersion===4&&(!/^(?:[a-f0-9]{2})+$/.test(policy.checkpointTapscript)||
        (policy.intent.branch==='fund'?
          policy.previousTransactionDigest!==undefined||policy.fundingOutpoint!==undefined:
          !/^[a-f0-9]{64}$/.test(policy.previousTransactionDigest??'')||
          !/^[a-f0-9]{64}$/.test(policy.fundingOutpoint?.txid??'')||!Number.isSafeInteger(policy.fundingOutpoint?.vout)||
          (policy.fundingOutpoint?.vout??-1)<0||(policy.fundingOutpoint?.vout??0)>0xffffffff||plan.sourceOutpoints.length!==1||
          plan.sourceOutpoints[0]!==`${policy.fundingOutpoint?.txid}:${policy.fundingOutpoint?.vout}`)))throw deny();
      if(policy.artifactVersion===4){
        if(policy.intent.branch!=='fund'){
          const root=psbt(plan.root),checkpoint=psbt(plan.checkpoints[0]);
          assertTreasureV4AuthorizationPair(root,checkpoint,policy);
          // A late spend may pass only when the signed ROOT already carries
          // the pinned emulator and Player signatures over this exact pair.
          assertTreasureSigningTransaction(root,root,policy,true);
        }
        if(!allowExpiredForCompletedRead)assertTreasurePolicyObservation(policy,now());
      }
    }
    if (authority === 'player' && plan.exposureSats === 0 && !plan.issuedAssets?.length && !plan.contractPolicy && !plan.assetPolicy) throw deny();
    return plan;
  };
  const verifyRootReceipt=(plan:Plan,planToken:string,receipt:unknown,binding:Binding,allowExpiredForCompletedRead=false)=>{
    if(typeof receipt!=='string'||!plan.treasurePolicy)throw deny();
    const version=plan.treasurePolicy.artifactVersion,domain=`bis-treasure-game-root-v${version}`;
    const scope=open(domain,receipt,version===4?1024*1024:512*1024);scoped(scope,binding,600000,allowExpiredForCompletedRead);
    if(scope.purpose!==domain||scope.planDigest!==signingDigest(planToken)||scope.rootRequestId!==plan.rootRequestId||scope.expires!==plan.expires||!Number.isSafeInteger(scope.completedAtMs)||scope.completedAtMs<plan.treasurePolicy.observedAtMs||scope.completedAtMs>now()||typeof scope.root!=='string'||
      version===4&&(!/^[a-f0-9]{64}$/.test(scope.rootRequestDigest??'')||!/^\d{4}-\d{2}-\d{2}$/.test(scope.rootClaimDay??'')||new Date(`${scope.rootClaimDay}T00:00:00.000Z`).toISOString().slice(0,10)!==scope.rootClaimDay))throw deny();
    const signed=psbt(scope.root),canonical=psbt(plan.root);
    if(version===4&&plan.treasurePolicy.intent.branch!=='fund')assertTreasureV4AuthorizationPair(signed,psbt(plan.checkpoints[0]),plan.treasurePolicy);
    assertTreasureSigningTransaction(signed,canonical,plan.treasurePolicy,true);
    for(let i=0;i<signed.inputsLength;i++)verifyTapscriptSignatures(signed,i,[plan.treasurePolicy.terms.game],[],[0,1]);
    assertTreasurePolicyCompletion(plan.treasurePolicy,scope.completedAtMs);
    return scope;
  };
  const validateRequest = (plan: Plan, request: any,planToken?:string,binding?:Binding,allowExpiredForCompletedRead=false) => {
    if (!request || request.method !== 'sign' || request.network !== plan.network || request.profileId !== plan.profileId || request.operationId !== plan.operationId || request.sessionId !== undefined) throw deny();
    const args = decodeSigningValue(request.args);
    if (!Array.isArray(args) || args.length !== 2 || !args[0] || typeof args[0].toPSBT !== 'function') throw deny();
    const tx = Transaction.fromPSBT(args[0].toPSBT());
    const indexes = args[1];
    if (indexes != null && (!Array.isArray(indexes) || indexes.length !== tx.inputsLength || indexes.some((value, index) => value !== index))) throw deny();
    const candidates = [plan.root, ...plan.checkpoints].map(psbt);
    const candidateIndex=candidates.findIndex(candidate=>candidate.id===tx.id),canonical=candidates[candidateIndex];
    if (!canonical) throw deny();
    const root=tx.id===candidates[0].id;
    if(plan.treasurePolicy){
      assertTreasureRawSigningValue(request.args,tx);
      if(plan.treasurePolicy.artifactVersion===4&&plan.treasurePolicy.intent.branch!=='fund'&&root)assertTreasureV4AuthorizationPair(tx,candidates[1],plan.treasurePolicy);
      assertTreasureSigningTransaction(tx,canonical,plan.treasurePolicy,root);
      if(root){if(request.id!==plan.rootRequestId||signingDigest(request.args)!==plan.rootArgsDigest||request.treasureRootReceipt!==undefined)throw deny();}
      else {if(!planToken||!binding)throw deny();verifyRootReceipt(plan,planToken,request.treasureRootReceipt,binding,allowExpiredForCompletedRead);}
    }else assertCanonicalSigningTransaction(tx, canonical);
    return { tx, rootId: candidates[0].id,root,...(!root?{checkpointIndex:candidateIndex-1}:{}) };
  };
  return {
    plan(binding: Binding, playerPublicKey: string | undefined, validated: ValidatedPlan,originalRequest?:any) {
      const plan: Plan = { ...binding, playerPublicKey, root: Buffer.from(validated.arkTx.toPSBT()).toString('base64'), checkpoints: validated.checkpoints.map(tx => Buffer.from(tx.toPSBT()).toString('base64')), sourceOutpoints: validated.sourceOutpoints, exposureSats: validated.exposureSats, expires: now() + 600000, purpose: planDomain };
      if (validated.issuedAssets) plan.issuedAssets = [...validated.issuedAssets];
      if (validated.assetPolicy) plan.assetPolicy = true;
      if (validated.contractPolicy) plan.contractPolicy = true;
      if(validated.receiptKeys)plan.receiptKeys=[...validated.receiptKeys];
      if(validated.treasurePolicy){
        plan.treasurePolicy=validated.treasurePolicy;plan.rootRequestId=originalRequest?.id;plan.rootArgsDigest=signingDigest(originalRequest?.args);
        const originalArgs=decodeSigningValue(originalRequest?.args);
        if(!originalArgs?.[0]||typeof originalArgs[0].toPSBT!=='function')throw deny();
        assertTreasureRawSigningValue(originalRequest.args,Transaction.fromPSBT(originalArgs[0].toPSBT()));
      }
      const domain=plan.treasurePolicy?.artifactVersion===4?treasureV4PlanDomain:planDomain;plan.purpose=domain;
      const token = seal(domain, plan);
      readPlan(token, binding);
      if(plan.treasurePolicy)assertTreasurePolicyObservation(plan.treasurePolicy,now());
      return token;
    },
    authorize(planToken: string, request: unknown, binding: Binding, playerPublicKey: string | undefined) {
      try {
        const plan = readPlan(planToken, binding);
        if (plan.playerPublicKey !== playerPublicKey) throw deny();
        validateRequest(plan, request,planToken,binding);
        const domain=plan.treasurePolicy?.artifactVersion===4?treasureV4GrantDomain:grantDomain;
        return seal(domain, { ...binding, digest: signingDigest(request), planDigest: signingDigest(planToken), expires: now() + 60000, purpose: domain });
      } catch { throw deny(); }
    },
    verify(grant: string, planToken: string, request: unknown, binding: Binding) {
      try {
        const plan=readPlan(planToken,binding),domain=plan.treasurePolicy?.artifactVersion===4?treasureV4GrantDomain:grantDomain;
        const scope = open(domain, grant, 4096);
        scoped(scope, binding, 60000);
        if (scope.purpose !== domain || scope.digest !== signingDigest(request) || scope.planDigest !== signingDigest(planToken)) throw deny();
        const { tx, rootId } = validateRequest(plan, request,planToken,binding);
        const inputs = [...plan.sourceOutpoints,...(plan.receiptKeys??[])];
        for (let index = 0; index < tx.inputsLength; index++) {
          const input = tx.getInput(index);
          if (!input.txid || input.index === undefined) throw deny();
          inputs.push(`${toHex(input.txid)}:${input.index}`);
        }
        return { operationId: plan.operationId, exposureSats: plan.exposureSats, exposureId: rootId, transactionId: rootId, inputs: [...new Set(inputs)],
          ...(plan.assetPolicy ? { assetPolicy: true } : {}),
          ...(plan.contractPolicy ? { contractPolicy: true } : {}),
          ...(tx.id === rootId && plan.issuedAssets && plan.playerPublicKey ? { issuedAssets: plan.issuedAssets.map(assetId => ({ assetId, playerPublicKey: plan.playerPublicKey! })) } : {}) };
      } catch { throw deny(); }
    },
    /** Authenticate and validate an original V4 request before a caller is
     * allowed to reach the result store's read-only lookup. */
    verifyReplay(planToken:string,request:unknown,binding:Binding){
      try{
        const plan=readPlan(planToken,binding,true);
        if(plan.treasurePolicy?.artifactVersion!==4)throw deny();
        validateRequest(plan,request,planToken,binding,true);
        return true;
      }catch{throw deny();}
    },
    isV4Checkpoint(planToken:string,request:unknown,binding:Binding){
      try{const plan=readPlan(planToken,binding);const checked=validateRequest(plan,request,planToken,binding);
        return plan.treasurePolicy?.artifactVersion===4&&!checked.root;
      }catch{throw deny();}
    },
    checkpointReference(planToken:string,request:unknown,binding:Binding){
      try{const plan=readPlan(planToken,binding,true),checked=validateRequest(plan,request,planToken,binding,true);
        if(plan.treasurePolicy?.artifactVersion!==4||checked.root)throw deny();
        const receipt=verifyRootReceipt(plan,planToken,(request as any).treasureRootReceipt,binding,true);
        return {rootRequestId:plan.rootRequestId!,rootRequestDigest:receipt.rootRequestDigest,rootClaimDay:receipt.rootClaimDay,
          operationId:plan.operationId,exposureSats:plan.exposureSats,
          ...(plan.playerPublicKey?{playerPublicKey:plan.playerPublicKey}:{})};
      }catch{throw deny();}
    },
    /** Validate a completed V4 Treasure result for read-only recovery. This
     * authenticates the original plan and exact request but never grants a
     * fresh signing capability or consults the wallet/provider. */
    recoverCompleted(planToken:string,request:unknown,binding:Binding,stored:unknown){
      try{
        const plan=readPlan(planToken,binding,true);
        if(plan.treasurePolicy?.artifactVersion!==4)throw deny();
        const checked=validateRequest(plan,request,planToken,binding,true),policy=plan.treasurePolicy;
        if(checked.root){
          if(!stored||typeof stored!=='object'||Array.isArray(stored)||Object.keys(stored).sort().join(',')!=='result,treasureRootReceipt'||typeof (stored as any).treasureRootReceipt!=='string')throw deny();
          const envelope=stored as {result:unknown;treasureRootReceipt:string};
          const signed=decodeSigningValue(envelope.result);if(!signed||typeof signed.toPSBT!=='function')throw deny();
          const tx=Transaction.fromPSBT(signed.toPSBT()),receipt=verifyRootReceipt(plan,planToken,envelope.treasureRootReceipt,binding,true),receiptTx=psbt(receipt.root);
          if(receipt.rootRequestDigest!==signingDigest(request))throw deny();
          if(!Buffer.from(tx.toPSBT()).equals(Buffer.from(receiptTx.toPSBT())))throw deny();
          if(policy.intent.branch!=='fund')assertTreasureV4AuthorizationPair(tx,psbt(plan.checkpoints[0]),policy);
          assertTreasureSigningTransaction(tx,psbt(plan.root),policy,true);
          for(let i=0;i<tx.inputsLength;i++)verifyTapscriptSignatures(tx,i,[policy.terms.game],[],[0,1]);
          return stored;
        }else{
          const signed=decodeSigningValue(stored);if(!signed||typeof signed.toPSBT!=='function')throw deny();
          const tx=Transaction.fromPSBT(signed.toPSBT());
          assertTreasureSigningTransaction(tx,checked.tx,policy,false);
          assertTreasureSignatureRetention(Buffer.from(checked.tx.toPSBT()).toString('base64'),Buffer.from(tx.toPSBT()).toString('base64'),tx.inputsLength,tx.outputsLength);
          for(let i=0;i<tx.inputsLength;i++)verifyTapscriptSignatures(tx,i,[policy.terms.game],[],[0,1]);
          return {result:stored};
        }
      }catch{throw deny();}
    },
    /** Execute inside the durable coordinatedSigning callback. Exact replays
     * return the stored envelope without minting another clock observation. */
    async sign(planToken:string,request:unknown,binding:Binding,execute:()=>Promise<unknown>,rootClaimDay?:string){
      const plan=readPlan(planToken,binding),checked=validateRequest(plan,request,planToken,binding);
      if(!plan.treasurePolicy||!checked.root)return execute();
      assertTreasurePolicyObservation(plan.treasurePolicy,now());
      const result=await execute(),completedAtMs=now();
      const signed=decodeSigningValue(result);if(!signed||typeof signed.toPSBT!=='function')throw deny();
      const tx=Transaction.fromPSBT(signed.toPSBT());
      if(plan.treasurePolicy.artifactVersion===4&&plan.treasurePolicy.intent.branch!=='fund')assertTreasureV4AuthorizationPair(tx,psbt(plan.checkpoints[0]),plan.treasurePolicy);
      assertTreasureSigningTransaction(tx,psbt(plan.root),plan.treasurePolicy,true);
      for(let i=0;i<tx.inputsLength;i++)verifyTapscriptSignatures(tx,i,[plan.treasurePolicy.terms.game],[],[0,1]);
      assertTreasurePolicyCompletion(plan.treasurePolicy,completedAtMs);
      const domain=`bis-treasure-game-root-v${plan.treasurePolicy.artifactVersion}`;
      const v4=plan.treasurePolicy.artifactVersion===4;
      if(v4&&(!/^[0-9a-f]{64}$/.test(signingDigest(request))||typeof rootClaimDay!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(rootClaimDay)||new Date(`${rootClaimDay}T00:00:00.000Z`).toISOString().slice(0,10)!==rootClaimDay))throw deny();
      const treasureRootReceipt=seal(domain,{...binding,rootRequestId:plan.rootRequestId,...(v4?{rootRequestDigest:signingDigest(request),rootClaimDay}:{}),planDigest:signingDigest(planToken),root:Buffer.from(tx.toPSBT()).toString('base64'),completedAtMs,expires:plan.expires,purpose:domain});
      return {result,treasureRootReceipt};
    },
    /** Verify the exact original CP and ROOT result without a wallet/provider call,
     * then expose only the fields needed to construct the one-shot journal claim. */
    checkpointCompletion(planToken:string,request:unknown,binding:Binding,parentResult:unknown):VerifiedTreasureCheckpoint{
      try{
        const plan=readPlan(planToken,binding,true),checked=validateRequest(plan,request,planToken,binding,true),policy=plan.treasurePolicy;
        if(policy?.artifactVersion!==4||checked.root)throw deny();
        const original=request as Record<string,any>,receipt=verifyRootReceipt(plan,planToken,original.treasureRootReceipt,binding,true);
        if(!parentResult||typeof parentResult!=='object'||Array.isArray(parentResult)||Object.keys(parentResult).sort().join(',')!=='result,treasureRootReceipt'||
          (parentResult as any).treasureRootReceipt!==original.treasureRootReceipt)throw deny();
        const rootValue=decodeSigningValue((parentResult as any).result);
        if(!rootValue||typeof rootValue.toPSBT!=='function')throw deny();
        const rootTx=Transaction.fromPSBT(rootValue.toPSBT()),receiptTx=psbt(receipt.root),canonicalRoot=psbt(plan.root);
        if(!Buffer.from(rootTx.toPSBT()).equals(Buffer.from(receiptTx.toPSBT())))throw deny();
        if(policy.intent.branch!=='fund')assertTreasureV4AuthorizationPair(rootTx,psbt(plan.checkpoints[0]),policy);
        assertTreasureSigningTransaction(rootTx,canonicalRoot,policy,true);
        for(let i=0;i<rootTx.inputsLength;i++)verifyTapscriptSignatures(rootTx,i,[policy.terms.game],[],[0,1]);
        const transactionInputs=(tx:Transaction)=>Array.from({length:tx.inputsLength},(_,index)=>{
          const input=tx.getInput(index);if(!input.txid||input.index===undefined)throw deny();return `${toHex(input.txid)}:${input.index}`;
        });
        const rootOutpoints=transactionInputs(rootTx),checkpointTransactionInputs=transactionInputs(checked.tx);
        if(checked.checkpointIndex===undefined||checked.checkpointIndex>=plan.checkpoints.length||checked.checkpointIndex>=plan.sourceOutpoints.length||
          checked.tx.id!==psbt(plan.checkpoints[checked.checkpointIndex]).id||checkpointTransactionInputs.length!==1||
          checkpointTransactionInputs[0]!==plan.sourceOutpoints[checked.checkpointIndex])throw deny();
        const checkpointOutpoint=`${checked.tx.id}:0`,checkpointRootInputs=rootOutpoints.filter(outpoint=>outpoint===checkpointOutpoint);
        if(checkpointRootInputs.length!==1)throw deny();
        const [checkpointTxid,checkpointIndexText]=checkpointOutpoint.split(':'),checkpointIndex=Number(checkpointIndexText);
        if(!Number.isSafeInteger(checkpointIndex)||checkpointIndex<0||checkpointIndex>0xffffffff)throw deny();
        assertTreasureSigningTransaction(checked.tx,psbt(plan.checkpoints[checked.checkpointIndex]),policy,false);
        return {rootRequestId:plan.rootRequestId!,rootRequestDigest:receipt.rootRequestDigest,rootClaimDay:receipt.rootClaimDay,
          operationId:plan.operationId,exposureSats:plan.exposureSats,
          rootTransactionId:rootTx.id,rootInputs:[...new Set([...plan.sourceOutpoints,...(plan.receiptKeys??[]),...rootOutpoints])],
          checkpointInputs:[...new Set([...plan.sourceOutpoints,...(plan.receiptKeys??[]),...rootOutpoints,...checkpointTransactionInputs])],
          checkpointOutpoint:{txid:checkpointTxid,index:checkpointIndex},checkpointIndex,parentResult,
          ...(plan.playerPublicKey?{playerPublicKey:plan.playerPublicKey}:{})};
      }catch{throw deny();}
    },
    verifyCheckpointResult(planToken:string,request:unknown,binding:Binding,result:unknown){
      try{
        const plan=readPlan(planToken,binding,true),checked=validateRequest(plan,request,planToken,binding,true),policy=plan.treasurePolicy;
        if(policy?.artifactVersion!==4||checked.root)throw deny();
        const signed=decodeSigningValue(result);if(!signed||typeof signed.toPSBT!=='function')throw deny();
        const tx=Transaction.fromPSBT(signed.toPSBT());
        if(checked.checkpointIndex===undefined)throw deny();
        assertTreasureSigningTransaction(tx,psbt(plan.checkpoints[checked.checkpointIndex]),policy,false);
        assertTreasureSignatureRetention(Buffer.from(checked.tx.toPSBT()).toString('base64'),Buffer.from(tx.toPSBT()).toString('base64'),tx.inputsLength,tx.outputsLength);
        for(let i=0;i<tx.inputsLength;i++)verifyTapscriptSignatures(tx,i,[policy.terms.game],[],[0,1]);
        return result;
      }catch{throw deny();}
    },
    response(value:unknown){
      if(value&&typeof value==='object'&&'treasureRootReceipt' in value&&'result' in value&&typeof value.treasureRootReceipt==='string')return value;
      return {result:value};
    },
  };
}
