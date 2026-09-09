import type {Identity} from '@arkade-os/sdk';
export type PlayerProof={publicKey:string;timestamp:number;nonce:string;signature:string};
export const bytesHex=(bytes:Uint8Array)=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
export const fromHex=(value:string)=>Uint8Array.from(value.match(/../g)??[],b=>parseInt(b,16));
export async function requestDigest(method:string,path:string,timestamp:number,nonce:string,body:string) {
 return new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(`bis-wallet-v1\n${method}\n${path}\n${timestamp}\n${nonce}\n${body}`)));
}
export async function makeProof(identity:Identity,method:string,path:string,body:string):Promise<PlayerProof> {
 const timestamp=Date.now(),nonce=crypto.randomUUID();
 return {publicKey:bytesHex(await identity.compressedPublicKey()),timestamp,nonce,signature:bytesHex(await identity.signMessage(await requestDigest(method,path,timestamp,nonce,body),'schnorr'))};
}
