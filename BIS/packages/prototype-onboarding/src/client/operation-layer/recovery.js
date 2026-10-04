const transientNames=new Set(['FetchError','ProviderUnavailableError','EventSourceError','SigningInterruptedError','SettlementStreamTimeoutError','RequestTimeoutError','ObservationTimeoutError','AbortError','LockTimeoutError','DigestMismatchError','BatchFailedError']);
export function batchFailure(error){
 const reason=String(error?.message??'').toLowerCase();
 if(/invalid|expired|dust|insufficient|fee|banned|verification/.test(reason))return Object.assign(new Error('Batch validation failed.'),{name:'ValidationError'});
 return Object.assign(new Error('The settlement batch failed; original inputs require reconciliation.'),{name:'BatchFailedError'});
}
const invalid=/^(The operator|SDK outputs|The selected|Captured|Invalid funding|Funding amount|Transfer percentage|Network mismatch|Signet required|Unexpected address|Account changed|Registration is not authorized|Repeat registration blocked)/;
export function classifyFailure(error,{mutation=false}={}){
 const name=error?.name;
 if(name==='StaleOperationError')return 'stale';
 if(name==='StorageError'||name==='CapabilityError'||name==='OperationQuarantinedError'||name==='OperationError')return 'blocked';
 if(name==='ValidationError'||invalid.test(error?.message??'')||(/^[A-Z_]+$/.test(name??'')&&Number.isInteger(error?.code)&&!(name==='INTERNAL_ERROR'&&error.code===0)))return 'validation';
 if(transientNames.has(name)||(name==='INTERNAL_ERROR'&&error?.code===0)||error?.status===429||error?.status>=500||error?.message==='Failed to fetch')return 'transient';
 return mutation?'uncertain':'unknown';
}
export function nextRetry(previous,error,{now=Date.now(),random=Math.random,mutation=false,step=1}={}){
 const category=classifyFailure(error,{mutation}),attempts=(previous?.attempts??0)+1;
 const cap=mutation?300000:60000,base=mutation?30000:5000;
 const delay=Math.min(cap,base*2**Math.min(16,attempts-1)*(1+Math.max(0,Math.min(1,random()))*.2));
 const retry=category==='transient'||(category==='unknown'&&attempts<=3);
 const retryAfterAt=Number.isFinite(error?.retryAfterAt)?error.retryAfterAt:0;
 return {step,category,attempts,paused:!retry,nextAt:retry?Math.max(now+delay,retryAfterAt,previous?.retryAfterAt??0):0,retryAfterAt:Math.max(retryAfterAt,previous?.retryAfterAt??0)};
}
export function retryDue(record,now=Date.now()){return !record||(!record.paused&&now>=record.nextAt&&now>=(record.retryAfterAt??0));}
export function recoveryMessage(record,now=Date.now()){
 if(!record)return '';
 const reasons={transient:'Connection interrupted',unknown:'Unexpected failure',uncertain:'Transfer outcome uncertain',blocked:'Required resource unavailable',validation:'Validation needs attention',stale:'Account changed'};
 return `${reasons[record.category]??'Check interrupted'}. ${record.paused?'Paused · recheck after resolving the blocker.':`Recovering · retry in ${Math.max(0,Math.ceil((record.nextAt-now)/1000))}s.`} Attempt ${record.attempts}.`;
}
