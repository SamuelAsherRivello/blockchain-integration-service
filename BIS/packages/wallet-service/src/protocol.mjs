import {createHash} from 'node:crypto';
import {schnorr} from '@noble/curves/secp256k1.js';
import {Transaction} from '@arkade-os/sdk';

export function verifyProof(proof,method,path,body,seen,now=Date.now()) {
 if(!proof||!/^(02|03)[a-f0-9]{64}$/.test(proof.publicKey)||!/^[a-f0-9]{128}$/.test(proof.signature)||!Number.isSafeInteger(proof.timestamp)||Math.abs(now-proof.timestamp)>30000||typeof proof.nonce!=='string'||!/^[a-f0-9-]{36}$/.test(proof.nonce))throw Error('Player authentication required.');
 const digest=createHash('sha256').update(`bis-wallet-v1\n${method}\n${path}\n${proof.timestamp}\n${proof.nonce}\n${body}`).digest();
 if(!schnorr.verify(Buffer.from(proof.signature,'hex'),digest,Buffer.from(proof.publicKey.slice(2),'hex')))throw Error('Player authentication required.');
 for(const [key,time]of seen)if(now-time>60000)seen.delete(key);
 const key=proof.publicKey+proof.nonce;if(seen.has(key))throw Error('Request already received.');seen.set(key,now);
 return {publicKey:proof.publicKey,profileId:createHash('sha256').update(Buffer.from(proof.publicKey,'hex')).digest('hex')};
}

export function mergeClaimSignature(original,encoded) {
 if(typeof encoded!=='string'||encoded.length>1000000)throw Error('Invalid claim signature.');
 const signed=Transaction.fromPSBT(Buffer.from(encoded,'base64'));
 if(!Buffer.from(original.unsignedTx).equals(Buffer.from(signed.unsignedTx)))throw Error('Claim transaction changed.');
 return original.clone().combine(signed);
}

export function privateAdminRequest(request) {
 try {
  const host=new URL(`http://${request.headers.host}`),origin=new URL(request.headers.origin);
  return ['127.0.0.1','localhost','[::1]'].includes(host.hostname)&&['127.0.0.1','localhost','[::1]'].includes(origin.hostname)&&['127.0.0.1','::1','::ffff:127.0.0.1'].includes(request.socket.remoteAddress);
 }catch{return false;}
}
