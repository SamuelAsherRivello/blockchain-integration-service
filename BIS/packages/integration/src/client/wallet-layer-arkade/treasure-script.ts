import {arkade} from '@arkade-os/sdk';
import {hex} from '@scure/base';
import type {TestNetwork} from '../state-layer-core/test-network.ts';

/** Versioned contract artifact. Qualification limits are recorded in the acceptance report. */
export type TreasureScriptTerms = Readonly<{
  network: TestNetwork; offerSessionId: string; hostReference: string; startedAtMs: number;
  player: string; game: string; operator: string; emulator: string;
  playerDestination: string; gameDestination: string; exitDelay: number;
}>;

export function treasureDeadlineSeconds(startedAtMs: number): number {
  if(!Number.isSafeInteger(startedAtMs)||startedAtMs<500_000_000_000||startedAtMs>Number.MAX_SAFE_INTEGER-90_000)
    throw Error('Invalid treasure start.');
  return Math.floor(startedAtMs/1000)+90;
}

/** All authorization and destinations are committed in the compiled script tree. */
export function buildTreasureScript(terms: TreasureScriptTerms) {
  const deadline=treasureDeadlineSeconds(terms.startedAtMs);
  for(const field of ['player','game','operator','emulator','playerDestination','gameDestination'] as const)
    if(!/^[a-f0-9]{64}$/.test(terms[field]))throw Error('Invalid treasure public key.');
  if(new Set([terms.player,terms.game,terms.operator,terms.emulator]).size!==4||
    !['signet','mutinynet'].includes(terms.network)||
    ![terms.offerSessionId,terms.hostReference].every(value=>typeof value==='string'&&value.trim()===value&&
      value.length>0&&value.length<=256&&!/[\u0000-\u001f\u007f]/.test(value))||
    !Number.isSafeInteger(terms.exitDelay)||terms.exitDelay<512||terms.exitDelay%512!==0||terms.exitDelay>65535*512)
    throw Error('Invalid treasure binding.');
  const scope=new TextEncoder().encode(JSON.stringify([
    'bis:treasure:v2',terms.network,terms.offerSessionId,terms.hostReference,terms.startedAtMs,
  ]));
  // The literal scope is committed in bytecode and must fit the VM stack limit.
  if(scope.length>520)throw Error('Treasure binding exceeds script limits.');
  const spend=(destination: string,signers: string[],expired: boolean)=>({
    inputs:[],tapscript:{signers},arkadeScript:{asm:[
      '$scope','DROP','$deadline','CHECKTIME',...(expired?[]:['NOT']),'VERIFY',
      'INSPECTNUMINPUTS',1,'EQUALVERIFY',0,'INSPECTINPUTVALUE',1000,'EQUALVERIFY',
      'INSPECTNUMOUTPUTS',3,'EQUALVERIFY',0,'INSPECTPACKET','NOT','VERIFY','DROP',
      0,'INSPECTOUTPUTSCRIPTPUBKEY',1,'EQUALVERIFY',destination,'EQUALVERIFY',
      0,'INSPECTOUTPUTVALUE',1000,'EQUALVERIFY',1,'INSPECTOUTPUTVALUE',0,'EQUALVERIFY',
      2,'INSPECTOUTPUTSCRIPTPUBKEY',1,'EQUALVERIFY',new Uint8Array([0x4e,0x73]),'EQUALVERIFY',
      2,'INSPECTOUTPUTVALUE',0,'EQUAL',
    ],witness:[]},
  });
  const program={version:0,name:'BISTreasureV2',params:[
    {name:'scope',type:'bytes' as const},{name:'deadline',type:'int' as const},{name:'exitDelay',type:'int' as const},
    ...['player','game','operator'].map(name=>({name,type:'pubkey' as const})),
    ...['playerDestination','gameDestination'].map(name=>({name,type:'bytes' as const})),
  ],functions:{
    claim:spend('$playerDestination',['$operator','$player'],false),
    reject:spend('$gameDestination',['$operator','$player','$game'],false),
    cancel:spend('$gameDestination',['$operator','$player','$game'],false),
    refund:spend('$gameDestination',['$operator','$game'],true),
    exit:{tapscript:{signers:['$game'],csv:{type:'seconds' as const,value:'$exitDelay'}}},
  }};
  const args={scope,deadline:BigInt(deadline),exitDelay:BigInt(terms.exitDelay),
    player:hex.decode(terms.player),game:hex.decode(terms.game),operator:hex.decode(terms.operator),
    playerDestination:hex.decode(terms.playerDestination),gameDestination:hex.decode(terms.gameDestination)};
  const script=new arkade.ArkadeProgramScript(program,args,{
    serverKey:args.operator,userKey:args.player,emulatorKey:hex.decode(terms.emulator),
  });
  return {version:2 as const,program,args,script,deadlineSeconds:deadline};
}
