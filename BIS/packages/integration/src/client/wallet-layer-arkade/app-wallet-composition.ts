import type { AppWalletSession } from './adapter-session.ts';
// Composition handles, not phrases or profiles. No cross-app singleton wallet.
const owners=new WeakMap<Function,AppWalletSession>();
export function registerAppWalletOwner(subscribe:Function,owner:AppWalletSession){owners.set(subscribe,owner);}
export function appWalletOwner(subscribe:Function|undefined){return subscribe?owners.get(subscribe):undefined;}
