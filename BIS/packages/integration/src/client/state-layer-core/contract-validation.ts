import type {TestNetwork} from './test-network.ts';

export type ContractValidationMode='browser-policy-v1'|'arkade-covenant-v2';
export type ContractValidationPreference='auto'|ContractValidationMode;
export const contractValidationDescription=(mode:ContractValidationMode)=>mode==='arkade-covenant-v2'
  ?'Arkade co-signer validates the committed program. Live deadline-rejection and admission timing are not fully qualified. Requires the network co-signer.'
  :'Real Arkade contract transactions. Expiry and payout checks run in the browser and can be bypassed by a modified client.';
export function contractValidationOptions(network:TestNetwork):readonly ContractValidationMode[]{
  return network==='mutinynet'?['arkade-covenant-v2','browser-policy-v1']:['browser-policy-v1'];
}
/** Selection is pre-funding only. A submitted operation never calls this selector. */
export function selectContractValidation(network:TestNetwork,preference:ContractValidationPreference,coSignerAvailable:boolean):ContractValidationMode {
  if(!['auto','browser-policy-v1','arkade-covenant-v2'].includes(preference)||!['signet','mutinynet'].includes(network))throw Error('Unsupported contract validation choice.');
  if(preference==='browser-policy-v1')return preference;
  if(network==='mutinynet'&&coSignerAvailable)return 'arkade-covenant-v2';
  if(preference==='arkade-covenant-v2')throw Error('Arkade co-signer validation is unavailable on this network.');
  return 'browser-policy-v1';
}
