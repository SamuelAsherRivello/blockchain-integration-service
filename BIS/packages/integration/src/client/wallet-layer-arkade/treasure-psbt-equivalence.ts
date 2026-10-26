import {base64,hex} from '@scure/base';

export type TreasurePsbtEntry=Readonly<{key:Uint8Array;value:Uint8Array}>;
export type TreasurePsbtMaps=readonly (readonly TreasurePsbtEntry[])[];
const fail=()=>Error('Treasure PSBT metadata does not match its original.');
const equal=(a:Uint8Array,b:Uint8Array)=>a.length===b.length&&a.every((byte,i)=>byte===b[i]);
const magic=new Uint8Array([0x70,0x73,0x62,0x74,0xff]);
function compact(value:number){
  if(!Number.isSafeInteger(value)||value<0||value>1_000_000)throw fail();
  if(value<253)return new Uint8Array([value]);
  const bytes=new Uint8Array(value<=65535?3:5),view=new DataView(bytes.buffer);bytes[0]=bytes.length===3?253:254;
  if(bytes.length===3)view.setUint16(1,value,true);else view.setUint32(1,value,true);return bytes;
}
/** Bounded raw maps: no SDK decode/re-encode may silently drop metadata. */
export function decodeTreasurePsbtMaps(encoded:string,inputCount:number,outputCount:number):TreasurePsbtMaps{
  if(typeof encoded!=='string'||encoded.length>250_000||!Number.isSafeInteger(inputCount)||!Number.isSafeInteger(outputCount)||
    inputCount<1||inputCount>100||outputCount<1||outputCount>100)throw fail();
  let bytes:Uint8Array;
  try{bytes=base64.decode(encoded);}catch{throw fail();}
  if(base64.encode(bytes)!==encoded||!equal(bytes.subarray(0,5),magic))throw fail();
  let offset=5;
  const length=()=>{
    if(offset>=bytes.length)throw fail();const first=bytes[offset++];if(first<253)return first;
    const size=first===253?2:first===254?4:8;if(size===8||offset+size>bytes.length)throw fail();
    const view=new DataView(bytes.buffer,bytes.byteOffset+offset,size),value=size===2?view.getUint16(0,true):view.getUint32(0,true);offset+=size;
    if(value<(size===2?253:65536))throw fail();return value;
  };
  const maps:TreasurePsbtEntry[][]=[];
  for(let m=0;m<1+inputCount+outputCount;m++){
    const entries:TreasurePsbtEntry[]=[],seen=new Set<string>();
    for(;;){
      const count=length();if(count===0)break;
      if(count>10_000||offset+count>bytes.length||entries.length>=1024)throw fail();
      const key=bytes.slice(offset,offset+count);offset+=count;
      const id=hex.encode(key);if(seen.has(id))throw fail();seen.add(id);
      const size=length();if(offset+size>bytes.length)throw fail();
      const value=bytes.slice(offset,offset+size);offset+=size;
      if(m>0&&m<=inputCount&&key[0]===0x14&&key.length!==65)throw fail();
      entries.push({key,value});
    }
    maps.push(entries);
  }
  if(offset!==bytes.length)throw fail();return maps;
}
export function encodeTreasurePsbtMaps(maps:TreasurePsbtMaps):string{
  const parts=[magic,...maps.flatMap(entries=>[
    ...entries.flatMap(({key,value})=>[compact(key.length),key,compact(value.length),value]),new Uint8Array([0]),
  ])];
  const size=parts.reduce((sum,part)=>sum+part.length,0);if(size>187_500)throw fail();
  const bytes=new Uint8Array(size);let offset=0;
  for(const part of parts){bytes.set(part,offset);offset+=part.length;}return base64.encode(bytes);
}
/** Signature key/leaf/sighash/crypto checks are a separate mandatory stage.
 * Only input tapScriptSig fields are excluded from this structural comparison. */
export function assertTreasurePsbtEquivalent(candidate:string,original:string,inputCount:number,outputCount:number):void{
  const actual=decodeTreasurePsbtMaps(candidate,inputCount,outputCount),expected=decodeTreasurePsbtMaps(original,inputCount,outputCount);
  const canonical=(entries:readonly TreasurePsbtEntry[],input:boolean)=>entries.filter(({key})=>!input||key[0]!==0x14)
    .map(({key,value})=>[hex.encode(key),hex.encode(value)]).sort((a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:0);
  for(let i=0;i<actual.length;i++)if(JSON.stringify(canonical(actual[i],i>0&&i<=inputCount))!==JSON.stringify(canonical(expected[i],i>0&&i<=inputCount)))throw fail();
}
export function assertTreasureSignatureRetention(known:string,next:string,inputCount:number,outputCount:number):void{
  assertTreasurePsbtEquivalent(next,known,inputCount,outputCount);
  const before=decodeTreasurePsbtMaps(known,inputCount,outputCount),after=decodeTreasurePsbtMaps(next,inputCount,outputCount);
  for(let i=1;i<=inputCount;i++)for(const entry of before[i].filter(({key})=>key[0]===0x14)){
    const found=after[i].find(candidate=>equal(candidate.key,entry.key));if(!found||!equal(found.value,entry.value))throw fail();
  }
}
/** Deterministic original-only merge; does not authorize any signing key. */
export function mergeTreasurePsbtSignatures(original:string,retained:string,incoming:string,inputCount:number,outputCount:number):string{
  assertTreasurePsbtEquivalent(retained,original,inputCount,outputCount);assertTreasurePsbtEquivalent(incoming,original,inputCount,outputCount);
  const result=decodeTreasurePsbtMaps(original,inputCount,outputCount).map(entries=>[...entries]);
  const sources=[decodeTreasurePsbtMaps(retained,inputCount,outputCount),decodeTreasurePsbtMaps(incoming,inputCount,outputCount)];
  for(let i=1;i<=inputCount;i++){
    const signatures=new Map<string,TreasurePsbtEntry>();
    for(const maps of [result,...sources])for(const entry of maps[i].filter(({key})=>key[0]===0x14)){
      const key=hex.encode(entry.key),previous=signatures.get(key);if(previous&&!equal(previous.value,entry.value))throw fail();signatures.set(key,entry);
    }
    result[i]=[...result[i].filter(({key})=>key[0]!==0x14),...[...signatures].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([,entry])=>entry)];
  }
  return encodeTreasurePsbtMaps(result);
}
