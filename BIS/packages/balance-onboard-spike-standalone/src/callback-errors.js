export function errorSummary(error){
 const message=error instanceof Error?error.message:'';
 // Never persist provider payloads, signed transactions, keys, or arbitrary thrown values.
 const known=message.match(/^(?:Cannot read properties of (?:undefined|null) \(reading '[A-Za-z_][A-Za-z_0-9]*'\)|[A-Za-z_][A-Za-z_0-9.]* is not a function|[A-Za-z_][A-Za-z_0-9]* is not defined|Failed to fetch|NetworkError|Diagnostic stopped before registration|Repeat registration blocked\.|Registration is not authorized\.)$/);
 const locations=error instanceof Error?String(error.stack??'').split('\n').slice(1).map(line=>line.match(/(?:[\w.-]+\.js|[\w.-]+\.ts)(?:\?[^: )]*)?:\d+:\d+/)?.[0]).filter(Boolean).slice(0,4):[];
 return `${error instanceof TypeError?'TypeError':error instanceof ReferenceError?'ReferenceError':'Error'}: ${known?known[0]:'Details withheld to protect wallet data'}${locations.length?' · '+locations.join(' ← '):''}`;
}
export function guarded(callback,report){return function(...args){try{return Promise.resolve(callback.apply(this,args)).catch(error=>{report(error);});}catch(error){report(error);return Promise.resolve();}};}
