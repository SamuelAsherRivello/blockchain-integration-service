import {arkade} from '@arkade-os/sdk';
import {hex} from '@scure/base';
import {buildTreasureScript,type TreasureScriptTerms} from './treasure-script.ts';

export const TREASURE_STAGED_ARTIFACT_VERSION=3 as const;
export const treasureStagedBranches=['claim','reject','cancel','refund'] as const;
export type TreasureStagedBranch=typeof treasureStagedBranches[number];
type SdkProgram=ConstructorParameters<typeof arkade.ArkadeProgramScript>[0];
type SdkTweakedSigner=Extract<NonNullable<SdkProgram['functions'][string]['tapscript']>['signers'][number],{tweak:string}>;

/** New outputs only. The distinct domain changes VM bytes and tweaked keys.
 * Reuses v2's term validation/rules without mutating its program or builder.
 * Availability and funded qualification are deliberately not asserted here. */
export function buildStagedTreasureScript(terms:TreasureScriptTerms){
  const v2=buildTreasureScript(terms);
  const program:SdkProgram=structuredClone(v2.program);
  program.name='BISTreasureV3';
  program.params=[...(program.params??[]),{name:'emulator',type:'pubkey'}];
  for(const branch of treasureStagedBranches){
    const original=program.functions[branch].tapscript;
    if(!original)throw Error('Staged treasure artifact could not be compiled.');
    const emulator:SdkTweakedSigner={tweak:'$emulator',fn:branch};
    program.functions[branch].tapscript={...original,emulator:null,
      signers:[original.signers[0],emulator,...original.signers.slice(1)]};
  }
  const scope=new TextEncoder().encode(JSON.stringify([
    'bis:treasure:v3',terms.network,terms.offerSessionId,terms.hostReference,terms.startedAtMs,
  ]));
  if(scope.length>520)throw Error('Staged treasure binding exceeds script limits.');
  const args={...v2.args,scope,emulator:hex.decode(terms.emulator)};
  const script=new arkade.ArkadeProgramScript(program,args,v2.script.keys);
  return Object.freeze({artifactVersion:TREASURE_STAGED_ARTIFACT_VERSION,program,args,script,deadlineSeconds:v2.deadlineSeconds});
}
