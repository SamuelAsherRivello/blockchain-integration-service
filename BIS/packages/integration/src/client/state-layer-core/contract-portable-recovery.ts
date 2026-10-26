import {base64} from '@scure/base';
import {validateContractDocument,type ContractDocument} from './contract-storage.ts';
import {ContractError,contractResolved,type ContractRecord} from './contracts.ts';
import {testNetwork,type TestNetwork} from './test-network.ts';
import {treasureServerRecoveryPending} from './treasure-server-recovery.ts';

const limit=8_000_000,iterations=600_000;
const fail=()=>new ContractError('Recovery file could not be verified. Check the password, network and selected wallets. Existing records were retained.');
export type ContractRecoveryScope=Readonly<{network:TestNetwork;playerId:string;gameId:string}>;
const matches=(s:ContractRecord['scope'],expected:ContractRecoveryScope)=>s.network===expected.network&&
  s.operator===testNetwork(expected.network).operator&&s.playerId===expected.playerId&&s.gameId===expected.gameId;
const stable=(value:unknown):string=>JSON.stringify(value,(_key,v)=>v&&typeof v==='object'&&!Array.isArray(v)
  ?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
function keys(value:unknown,allowed:string) {
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!allowed.split(' ').includes(k)))throw fail();
}
/** Restrict portable data to the versioned journal schema. Wallet secrets are not fields. */
function inspect(document:unknown,scope:ContractRecoveryScope):asserts document is ContractDocument {
  if(!['signet','mutinynet'].includes(scope.network))throw fail();
  validateContractDocument(document);
  keys(document,'version revision ledger recovery');keys(document.ledger,'contracts attempts');
  if(document.ledger.contracts.length>100||document.ledger.attempts.length>1000||scope.playerId===scope.gameId)throw fail();
  for(const record of document.ledger.contracts) {
    keys(record,'version type scope id sessionId purpose hostReference amountSats startedAt expiresAt approved validationMode financial ended operation recoveryRequired');
    keys(record.scope,'network operator playerId gameId exclusivityKey');keys(record.operation,'id kind submission failure');
    if(!matches(record.scope,scope)||['__proto__','constructor','prototype'].includes(record.id))throw fail();
    const r=document.recovery[record.id];
    keys(r,'secretHex playerKey gameKey operatorKey exitDelay treasure treasureArtifactVersion treasureStage treasureServerJournals emulatorSubmission submission gameScript playerScript contractScript fundingOutput spend finalization');
    if(r.treasure)keys(r.treasure,'network offerSessionId hostReference startedAtMs player game operator emulator playerDestination gameDestination exitDelay');
    // The stage validator checks every nested key, original byte and signature.
    if(r.treasureStage)keys(r.treasureStage,'binding state');
    // Dynamic operation keys and every nested private journal are validated by
    // validateContractDocument; no opaque unvalidated extra fields are exported.
    if(r.fundingOutput)keys(r.fundingOutput,'txid vout value');
    if(r.spend){
      keys(r.spend,'operationId transactionId inputs destinationScript amountSats change');
      r.spend.inputs.forEach(i=>keys(i,'txid vout value'));
      if(r.spend.change){keys(r.spend.change,'script value assets');r.spend.change.assets?.forEach(a=>keys(a,'assetId amount'));}
    }
    if(r.emulatorSubmission)keys(r.emulatorSubmission,'transactionId arkTx checkpoints');
    if(r.submission)keys(r.submission,'transactionId arkTx checkpoints');
    if(r.finalization)keys(r.finalization,'transactionId checkpoints');
  }
  for(const attempt of document.ledger.attempts){
    keys(attempt,'scope sessionId status contractId');keys(attempt.scope,'network operator playerId gameId exclusivityKey');
    if(!matches(attempt.scope,scope))throw fail();
  }
}
function passwordBytes(password:string) {
  if(typeof password!=='string'||password.length<16||password.length>1024)throw fail();
  return new TextEncoder().encode(password);
}
async function derive(password:string,salt:Uint8Array<ArrayBuffer>) {
  const bytes=passwordBytes(password);
  try {
    const material=await crypto.subtle.importKey('raw',bytes,'PBKDF2',false,['deriveKey']);
    return await crypto.subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',salt,iterations},material,
      {name:'AES-GCM',length:256},false,['encrypt','decrypt']);
  }finally{bytes.fill(0);}
}
const aad=(network:TestNetwork)=>new TextEncoder().encode(`bis-contract-recovery:1:${network}:PBKDF2-SHA256:${iterations}:AES-256-GCM`);

/** Explicit export only. No mnemonic/private signing key is included. */
export async function exportContractRecovery(document:ContractDocument,scope:ContractRecoveryScope,password:string):Promise<string> {
  try {
    validateContractDocument(document);
    const records=document.ledger.contracts.filter(r=>matches(r.scope,scope)&&
      (!contractResolved(r)||treasureServerRecoveryPending(document.recovery[r.id])))
      .map(record=>contractResolved(record)?{...record,recoveryRequired:true}:record);
    const recovery=Object.fromEntries(records.map(r=>[r.id,document.recovery[r.id]]));
    const attempts=document.ledger.attempts.filter(a=>matches(a.scope,scope)).map(a=>a.status==='created'&&!records.some(r=>r.id===a.contractId)
      ?{scope:a.scope,sessionId:a.sessionId,status:'expired' as const}:a);
    const portable:ContractDocument={version:1,revision:0,ledger:{contracts:records,attempts},recovery};
    inspect(portable,scope);
    const plain=new TextEncoder().encode(JSON.stringify(portable));
    if(plain.length>limit/2)throw fail();
    const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));
    try {
      const key=await derive(password,salt);
      const ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:aad(scope.network)},key,plain);
      return JSON.stringify({format:'bis-contract-recovery',version:1,network:scope.network,kdf:'PBKDF2-SHA256',iterations,
        cipher:'AES-256-GCM',salt:base64.encode(salt),iv:base64.encode(iv),ciphertext:base64.encode(new Uint8Array(ciphertext))});
    }finally{plain.fill(0);}
  }catch{throw fail();}
}

/** Decrypt/validate in memory. Import does not submit, finalize or assert a financial outcome. */
export async function decryptContractRecovery(file:string,scope:ContractRecoveryScope,password:string):Promise<ContractDocument> {
  try {
    if(typeof file!=='string'||file.length>limit)throw fail();
    const envelope=JSON.parse(file);keys(envelope,'format version network kdf iterations cipher salt iv ciphertext');
    if(envelope.format!=='bis-contract-recovery'||envelope.version!==1||envelope.network!==scope.network||
      envelope.kdf!=='PBKDF2-SHA256'||envelope.iterations!==iterations||envelope.cipher!=='AES-256-GCM'||
      ![envelope.salt,envelope.iv,envelope.ciphertext].every(v=>typeof v==='string'&&/^[A-Za-z0-9+/]+={0,2}$/.test(v)))throw fail();
    const salt=new Uint8Array(base64.decode(envelope.salt)),iv=new Uint8Array(base64.decode(envelope.iv));
    if(salt.length!==16||iv.length!==12)throw fail();
    const key=await derive(password,salt);
    const plain=new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv,additionalData:aad(scope.network)},key,new Uint8Array(base64.decode(envelope.ciphertext))));
    try {
      const document:unknown=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(plain));
      inspect(document,scope);return document;
    }finally{plain.fill(0);}
  }catch{throw fail();}
}

/** Additive merge. A stale backup cannot replace newer local financial history. */
export function mergeContractRecovery(local:ContractDocument,incoming:ContractDocument,scope:ContractRecoveryScope):ContractDocument {
  try {
    validateContractDocument(local);inspect(incoming,scope);
    const contracts=[...local.ledger.contracts],recovery={...local.recovery},attempts=[...local.ledger.attempts];
    const withoutFlag=({recoveryRequired:_flag,...record}:ContractRecord)=>record;
    for(const record of incoming.ledger.contracts) {
      const existing=contracts.find(r=>r.id===record.id);
      if(existing){
        if(stable(withoutFlag(existing))!==stable(withoutFlag(record))||stable(recovery[record.id])!==stable(incoming.recovery[record.id]))throw fail();
      }else{
        if(contractResolved(record))throw fail();
        contracts.push({...record,recoveryRequired:true});recovery[record.id]=incoming.recovery[record.id];
      }
    }
    for(const attempt of incoming.ledger.attempts) {
      const existing=attempts.find(a=>stable(a.scope)===stable(attempt.scope)&&a.sessionId===attempt.sessionId);
      if(!existing)attempts.push(attempt);
      else if(stable(existing)!==stable(attempt)&&!(attempt.status==='expired'&&existing.status==='created'))throw fail();
    }
    const result={...local,ledger:{contracts,attempts},recovery};validateContractDocument(result);return result;
  }catch{throw fail();}
}
