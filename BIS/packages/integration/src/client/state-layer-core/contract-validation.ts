import {isTestNetwork,networkLabel,type TestNetwork} from './test-network.ts';

export type ContractValidationMode='browser-policy-v1'|'arkade-covenant-v2';
export type ContractValidationPreference='auto'|ContractValidationMode;
export const contractValidationDescription=(mode:ContractValidationMode)=>mode==='arkade-covenant-v2'
  ?'Arkade co-signer validates the committed program. Live deadline-rejection and admission timing are not fully qualified. Requires the network co-signer.'
  :'Real Arkade contract transactions. Expiry and payout checks run in the browser and can be bypassed by a modified client.';
export function contractValidationOptions(network:TestNetwork):readonly ContractValidationMode[]{
  return isTestNetwork(network)?['browser-policy-v1']:[];
}
/** Network compatibility is separate from login, balance and transport readiness.
 * Live acceptance still needs the exact candidate's real contract receipts.
 */
export function contractNetworkSupport(network:TestNetwork|undefined):Readonly<{supported:boolean;reason:string}>{
  if(!isTestNetwork(network))return {supported:false,reason:'Choose a test network to check Treasure contract support.'};
  if(!contractValidationOptions(network).includes('browser-policy-v1'))return {supported:false,reason:`Treasure Browser validation is unavailable on ${networkLabel(network)}.`};
  return {supported:true,reason:`${networkLabel(network)} supports Browser validation. Expiry and payout rules are checked by the browser.`};
}
/** Selection is pre-funding only. A submitted operation never calls this selector. */
export function selectContractValidation(network:TestNetwork,preference:ContractValidationPreference,_coSignerAvailable:boolean):ContractValidationMode {
  if(!['auto','browser-policy-v1','arkade-covenant-v2'].includes(preference)||!['signet','mutinynet'].includes(network))throw Error('Unsupported contract validation choice.');
  if(preference==='arkade-covenant-v2')throw Error('Arkade co-signer validation is unavailable for new offers in this release.');
  if(!contractNetworkSupport(network).supported)throw Error(contractNetworkSupport(network).reason);
  return 'browser-policy-v1';
}
