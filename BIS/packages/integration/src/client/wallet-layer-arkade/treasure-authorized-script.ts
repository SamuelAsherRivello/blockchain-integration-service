import {arkade,buildOffchainTx,CSVMultisigTapscript,type Transaction} from '@arkade-os/sdk';
import {hex} from '@scure/base';
import {sha256} from '@noble/hashes/sha2.js';
import {buildTreasureScript,treasureDeadlineSeconds,type TreasureScriptTerms} from './treasure-script.ts';
import {buildStagedTreasureScript,treasureStagedBranches,type TreasureStagedBranch} from './treasure-staged-script.ts';

export const TREASURE_AUTHORIZED_ARTIFACT_VERSION=4 as const;
export type AuthorizedTreasureBranch=TreasureStagedBranch;
type Program=ConstructorParameters<typeof arkade.ArkadeProgramScript>[0];
type Actor='player'|'game';
const actors:Readonly<Record<AuthorizedTreasureBranch,readonly Actor[]>>=Object.freeze({
  claim:Object.freeze(['player'] as const),reject:Object.freeze(['player','game'] as const),
  cancel:Object.freeze(['player','game'] as const),refund:Object.freeze(['game'] as const),
});
const invalid=()=>Error('Treasure authorization binding could not be verified.');
const equal=(a:Uint8Array,b:Uint8Array)=>a.length===b.length&&a.every((byte,index)=>byte===b[index]);
const join=(a:Uint8Array,b:Uint8Array)=>{const value=new Uint8Array(a.length+b.length);value.set(a);value.set(b,a.length);return value;};
function requireBranch(branch:AuthorizedTreasureBranch){if(!treasureStagedBranches.includes(branch))throw invalid();}

/** Canonical fixed-position encoding, never a witness-supplied message or digest.
 * The compiled script commits this hash. No script hash is fed back into itself. */
function scopeUnchecked(terms:TreasureScriptTerms,branch:AuthorizedTreasureBranch):Uint8Array{
  return sha256(new TextEncoder().encode(JSON.stringify([
    'bis:treasure:actor-authorization:v4',4,branch,terms.network,terms.offerSessionId,terms.hostReference,
    terms.startedAtMs,treasureDeadlineSeconds(terms.startedAtMs),terms.player,terms.game,terms.operator,terms.emulator,
    terms.playerDestination,terms.gameDestination,terms.exitDelay,1000,
  ])));
}

export function treasureAuthorizationScope(terms:TreasureScriptTerms,branch:AuthorizedTreasureBranch):Uint8Array{
  requireBranch(branch);buildTreasureScript(terms);return scopeUnchecked(terms,branch);
}

export function treasureAuthorizationActors(branch:AuthorizedTreasureBranch):readonly Actor[]{
  requireBranch(branch);return actors[branch];
}

/** Candidate only. This compiler does not claim native or hosted qualification.
 * Witness order, bottom to top: Claim [playerProof], Reject/Cancel
 * [playerProof,gameProof], Refund [gameProof]. Verification consumes top first.
 * All proofs are raw 64-byte Schnorr signatures over the same branch digest.
 * Ordinary tapscript authorities, tweaked emulator ordering and v2/v3 remain intact. */
export function buildAuthorizedTreasureScript(terms:TreasureScriptTerms){
  const original=buildStagedTreasureScript(terms),program:Program=structuredClone(original.program);
  program.name='BISTreasureV4';
  program.params=[...(program.params??[]),...treasureStagedBranches.map(branch=>({name:branch+'Authorization',type:'hash' as const}))];
  const scope=new TextEncoder().encode(JSON.stringify(['bis:treasure:v4',terms.network,terms.offerSessionId,terms.hostReference,terms.startedAtMs]));
  const args:Record<string,Uint8Array|bigint>={...original.args,scope};
  for(const branch of treasureStagedBranches){
    const fn=program.functions[branch];if(!fn?.arkadeScript)throw invalid();
    const branchActors=actors[branch];args[branch+'Authorization']=scopeUnchecked(terms,branch);
    fn.inputs=branchActors.map(actor=>({name:actor+'Proof',type:'sig' as const}));
    const authorization:NonNullable<typeof fn.arkadeScript>['asm']=[];
    for(const actor of [...branchActors].reverse())authorization.push(
      0,'INSPECTINPUTOUTPOINT',0,'EQUALVERIFY','$'+branch+'Authorization','CAT','SHA256','$'+actor,'CHECKSIGFROMSTACK','VERIFY',
    );
    fn.arkadeScript={
      asm:['PUSHEXPIRY',0,'GREATERTHAN','VERIFY',...authorization,...fn.arkadeScript.asm],
      witness:branchActors.map(actor=>actor+'Proof'),
    };
  }
  const script=new arkade.ArkadeProgramScript(program,args,original.script.keys);
  return Object.freeze({artifactVersion:TREASURE_AUTHORIZED_ARTIFACT_VERSION,program,args,script,deadlineSeconds:original.deadlineSeconds});
}

export type TreasureAuthorizationPair=Readonly<{
  arkTx:Transaction;checkpoint:Transaction;
  funding:Readonly<{txid:string;vout:number;value:1000}>;
  /** Independently trusted current operator checkpoint closure, not witness data. */
  checkpointTapscript:CSVMultisigTapscript.Type;
}>;

/** Derive from an actual canonical checkpoint and its ROOT input at index zero.
 * This validates the unsigned ancestry template, not signatures, funding presence,
 * provider freshness, other ROOT fields or full PSBT metadata. Those still require
 * strict transaction/stage validation before signing or submission. The intent
 * digest is deliberately independent of the proof-bearing ROOT output/witness. */
export function treasureAuthorizationDigest(
  terms:TreasureScriptTerms,branch:AuthorizedTreasureBranch,pair:TreasureAuthorizationPair,
):Uint8Array{
  requireBranch(branch);
  const {arkTx,checkpoint,funding}=pair,built=buildAuthorizedTreasureScript(terms),leaf=built.script.functionByName(branch);
  if(!leaf||!funding||!/^[a-f0-9]{64}$/.test(funding.txid)||!Number.isSafeInteger(funding.vout)||funding.vout<0||
    funding.vout>0xffffffff||funding.value!==1000||arkTx.inputsLength!==1||checkpoint.inputsLength!==1||checkpoint.outputsLength!==2)throw invalid();
  const unroll=CSVMultisigTapscript.decode(pair.checkpointTapscript.script);
  // The operator's advertised checkpoint forfeit key can differ from its
  // ordinary transaction signer. The caller authenticates this exact closure
  // against operator policy; canonical checkpoint reconstruction binds it here.
  if(unroll.params.pubkeys.length!==1)throw invalid();
  const canonical=buildOffchainTx([
    {txid:funding.txid,vout:funding.vout,value:1000,tapLeafScript:leaf.tapLeafScript,tapTree:built.script.encode()},
  ],[{script:hex.decode('5120'+(branch==='claim'?terms.playerDestination:terms.gameDestination)),amount:1000n}],unroll);
  const expected=canonical.checkpoints[0];
  if(!equal(checkpoint.toBytes(false,false),expected.toBytes(false,false)))throw invalid();
  for(const [actual,wanted] of [[checkpoint.getInput(0),expected.getInput(0)],[arkTx.getInput(0),canonical.arkTx.getInput(0)]]){
    if(!actual.witnessUtxo||!wanted.witnessUtxo||actual.witnessUtxo.amount!==wanted.witnessUtxo.amount||
      !equal(actual.witnessUtxo.script,wanted.witnessUtxo.script)||!actual.txid||!wanted.txid||!equal(actual.txid,wanted.txid)||
      actual.index!==wanted.index||actual.tapLeafScript?.length!==1||wanted.tapLeafScript?.length!==1||
      !equal(actual.tapLeafScript[0][1],wanted.tapLeafScript[0][1]))throw invalid();
  }
  const input=arkTx.getInput(0);if(input.index!==0||hex.encode(input.txid!)!==checkpoint.id)throw invalid();
  const wireHash=hex.decode(checkpoint.id).reverse();
  return sha256(join(wireHash,scopeUnchecked(terms,branch)));
}
