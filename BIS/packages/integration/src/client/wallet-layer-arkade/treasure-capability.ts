export const TREASURE_EMULATOR=Object.freeze({url:'https://emulator.mutinynet.arkade.sh',
  key:'03f823b9b2febc81f4af967e77aed2f541cbd3397c6d8f5a72e32eb7b471af889a'});

/** Read-only, bounded preflight. A false result never authorizes replacing a funded contract. */
export async function treasureCoSignerAvailable(send:typeof fetch=fetch):Promise<boolean>{
  try{
    const response=await send(`${TREASURE_EMULATOR.url}/v1/info`,{cache:'no-store',signal:AbortSignal.timeout(1500)});
    if(!response.ok)return false;
    const info:unknown=await response.json();
    return typeof info==='object'&&info!==null&&'signerPubkey' in info&&info.signerPubkey===TREASURE_EMULATOR.key;
  }catch{return false;}
}
