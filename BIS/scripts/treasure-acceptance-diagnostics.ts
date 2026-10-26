// Public acceptance diagnostics contain fixed classifications only. Provider,
// browser and private-input errors must not become output strings.
const reasons=new Set([
  'invalid-arguments','vault-locked','vault-not-initialized','vault-protection-unavailable','vault-invalid','unsafe-private-path',
  'test-grant-unavailable','test-identity-reserved','unexpected-test-network','acceptance-budget-unverified',
  'acceptance-operation-limit','acceptance-network-day-limit','original-admin-run-requires-reconciliation',
  'original-contract-not-listed','original-contract-mismatch','original-receipt-unresolved','original-wire-unverified',
  'original-indexed-receipt-unverified','original-operation-observation-timeout','binding-mismatch','existing-contract-needs-recovery',
  'identity-fixture-unavailable','coordinator-financial-slot-required','game-readiness-unavailable','network-fixture-unavailable',
  'legacy-artifact-unverified','legacy-installed-file-unverified','legacy-installed-file-changed','legacy-bundle-not-self-contained',
  'legacy-original-unverified','legacy-original-script-unverified','legacy-archive-layout-unverified','legacy-inventory-archive-mismatch',
  'wrong-network-financial-attempt','network-fixture-player-unavailable','network-fixture-game-unavailable','network-fixture-funding-unavailable',
  'legacy-player-unavailable','legacy-game-unavailable','legacy-funding-unavailable','player-not-empty','game-not-empty',
  'asset-carrier-only-precondition','insufficient-funds-unproven',
]);
const errorFlags=['unsafe-eval','Content Security Policy','dynamically imported module','strict mode violation','Execution context was destroyed','Failed to fetch'];
const uiFlags=['Maximum update','hooks','is not defined','Cannot read properties','is not a function','initialization','Maximum call stack','undefined'];
const browserStages=new Set(['profile','launch','addresses','navigate','restore','account-dialog','network-selection','player-restore',
  'player-confirmation-wait','player-confirmation-click','player-connected-wait','player-details','game-menu','game-restore','game-identity','game-network','private-clear']);
const browserFlags=new Set(['outside of the viewport','intercepts pointer events','not stable','not visible','strict mode violation','not attached',
  'dynamic','import','could not','fetch','storage','Storage','database','saved','crypto','closed','CSP','Content Security Policy','unsafe-eval']);
const names=new Set(['Error','TypeError','ReferenceError','RangeError','SyntaxError','console-error']);
const text=(value:unknown)=>typeof value==='string'?value.slice(0,8192):'';
function properties(value:unknown):Record<string,unknown>{return value!==null&&typeof value==='object'?value as Record<string,unknown>:{};}
function reason(value:unknown){return typeof value==='string'&&reasons.has(value)?value:undefined;}

export function publicAcceptanceFailure(error:unknown){
  const row=properties(error),message=text(row.message);
  return {ok:false,reason:reason(row.code)??reason(row.message)??'live-admin-acceptance-incomplete',
    errorFlags:errorFlags.filter(flag=>message.includes(flag)),timeout:row.name==='TimeoutError',errorType:row.name==='Error'?'Error':'other'};
}
export function publicAcceptanceUiError(message:unknown,name:unknown='console-error'){
  const value=text(message).toLowerCase();
  return {name:typeof name==='string'&&names.has(name)?name:'other',flags:Object.fromEntries(uiFlags.map(flag=>[flag,value.includes(flag.toLowerCase())]))};
}
export function publicAcceptanceBrowserFailure(details:unknown){
  const row=properties(details);
  return {stage:typeof row.stage==='string'&&browserStages.has(row.stage)?row.stage:'other',timeout:row.timeout===true,
    errorType:typeof row.errorType==='string'&&names.has(row.errorType)?row.errorType:'other',
    ...(reason(row.code)?{code:reason(row.code)}:{}),
    flags:Array.isArray(row.flags)?[...new Set(row.flags.slice(0,64).filter((flag):flag is string=>typeof flag==='string'&&browserFlags.has(flag)))]:[]};
}
