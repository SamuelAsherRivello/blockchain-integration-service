import type { BisContext, BisContractActionResult, createBisGameWallet, createBisLto } from '@bis/integration';
export type TreasureStatus='no-offer'|'missing-player'|'preparing'|'active'|'unavailable'|'pending'|'claimed'|'rejected'|'expired';
export type TreasureSnapshot={id:string;reference:string;expiresAt:number;status:TreasureStatus;offered:boolean;playerId?:string;gameId?:string;contractId?:string;gameVersion?:number};
export function createTreasureSession(options:{context:BisContext;offers:ReturnType<typeof createBisLto>;gameWallet:ReturnType<typeof createBisGameWallet>;now?:()=>number;newId?:()=>string}):{
  getState():{status:TreasureStatus;remainingSeconds:number;sessionId?:string;contractId?:string};
  subscribe(listener:()=>void):()=>void;start():void;end():void;inspect():Promise<void>;
  act(kind:'claim'|'reject'):Promise<BisContractActionResult>;snapshot():TreasureSnapshot|undefined;restore(saved:unknown):boolean;dispose(options?:{preserveSession?:boolean}):void;
};
export function treasureMessage(status:TreasureStatus):string;
