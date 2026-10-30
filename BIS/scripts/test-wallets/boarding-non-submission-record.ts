import {sha256} from '@noble/hashes/sha2.js';
import {bytesToHex} from '@noble/hashes/utils.js';

const hash=(value:unknown)=>bytesToHex(sha256(new TextEncoder().encode(JSON.stringify(value))));
/** Recognize an already verified resolution. Creating that resolution still
 * requires the original Node-only journal and actor verification.
 */
export function hasVerifiedBoardingNonSubmission(record:any):boolean{
  const r=record?.resolution;if(!r)return false;
  const {digest,...body}=r;
  return record.state==='cancelled'&&record.providerId===undefined&&record.intent?.kind==='btc-send'&&record.fingerprint===hash(record.intent)&&!!record.intent.serverSource&&
    r.kind==='verified-guarded-boarding-non-submission'&&r.previousState==='unknown'&&r.networkOutcome==='not-submitted'&&r.verified===true&&r.exposureSats===0&&
    r.proof?.operationFingerprint===record.fingerprint&&r.proof?.runId+'-board'===record.intent.id&&r.proof?.financialDispatches===0&&r.proof?.successfulSignatures===0&&digest===hash(body);
}
