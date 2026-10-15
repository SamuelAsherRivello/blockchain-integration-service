export function errorSummary(error){
 if(error?.name==='BatchFailedError')return 'Error: The settlement batch failed. Rechecking original inputs before SDK recovery.';
 if(error?.name==='ValidationError')return 'Error: Transfer validation failed. Automatic signing is paused.';
 const safeNames={LockTimeoutError:'Workflow lock timed out. Rechecking the saved operation.',RequestTimeoutError:'Network request timed out. Its outcome will be rechecked.',ObservationTimeoutError:'Status observation timed out. Retrying safely.',StorageError:'Browser storage unavailable. Saved data is retained.',StaleOperationError:'A newer account or attempt superseded this result.',RecoveryPendingError:'Waiting for the scheduled recheck.'};
 if(safeNames[error?.name])return `Error: ${safeNames[error.name]}`;
 const message=error instanceof Error?error.message:'';
 if(message.startsWith('Failed to register intent: ')){
  try{
   const detail=JSON.parse(message.slice('Failed to register intent: '.length));
   if(Number.isInteger(detail.code)&&detail.code>=0&&detail.code<=16&&typeof detail.message==='string')
    return errorSummary(Object.assign(new Error(detail.message),{name:'REGISTRATION_REJECTED',code:detail.code}));
  }catch{/* Do not expose unstructured server responses. */}
 }
 if(error instanceof Error&&error.name==='FetchError')return 'Error: Network request failed. The server response was not received.';
 if(error instanceof Error&&error.name==='ProviderUnavailableError')return 'Error: Network provider temporarily unavailable.';
 // Never persist provider payloads, signed transactions, keys, or arbitrary thrown values.
 const known=message.match(/^(?:Cannot read properties of (?:undefined|null) \(reading '[A-Za-z_][A-Za-z_0-9]*'\)|[A-Za-z_][A-Za-z_0-9.]* is not a function|[A-Za-z_][A-Za-z_0-9]* is not defined|Failed to fetch|NetworkError|Diagnostic stopped before registration|Repeat registration blocked\.|Registration is not authorized\.)$/);
 const operator=Number.isSafeInteger(error?.code)&&/^[A-Z_]{2,50}$/.test(error?.name??'')?`${error.name} (${error.code})`:'';
 const vocabulary=new Set('invalid boarding input inputs output outputs amount fee fees below above minimum maximum dust insufficient balance confirmed unconfirmed confirmation confirmations intent register registration failed expired spent already duplicated duplicate script signature proof locktime timelock expected required not supported disabled banned banned until rate limit exceeded too small large server internal error transaction version missing'.split(' '));
 const category=operator?message.toLowerCase().split(/[^a-z]+/).filter(word=>vocabulary.has(word)).slice(0,30).join(' '):'';
 const locations=error instanceof Error?String(error.stack??'').split('\n').slice(1).map(line=>line.match(/(?:[\w.-]+\.js|[\w.-]+\.ts)(?:\?[^: )]*)?:\d+:\d+/)?.[0]).filter(Boolean).slice(0,4):[];
 return `${error instanceof TypeError?'TypeError':error instanceof ReferenceError?'ReferenceError':'Error'}: ${known?known[0]:operator?`${operator} · ${category||'Operator rejected request'}`:'Details withheld to protect wallet data'}${locations.length?' · '+locations.join(' ← '):''}`;
}
export function guarded(callback,report){return function(...args){try{return Promise.resolve(callback.apply(this,args)).catch(error=>{report(error);});}catch(error){report(error);return Promise.resolve();}};}
