import type { AppWalletSession } from './adapter-session.ts';
// Composition handles, not phrases or profiles. No cross-app singleton wallet.
const owners=new WeakMap<Function,AppWalletSession>();
const eligibility=new WeakMap<Function,()=>boolean>();
export function registerAppWalletOwner(subscribe:Function,owner:AppWalletSession,eligible=()=>true){owners.set(subscribe,owner);eligibility.set(subscribe,eligible);}
export function appWalletOwner(subscribe:Function|undefined){return subscribe?owners.get(subscribe):undefined;}
export function appPlayerEligible(subscribe:Function|undefined){return subscribe?eligibility.get(subscribe):undefined;}
