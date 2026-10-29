import type {TestNetwork} from './test-network.ts';

export type GameWalletWorkflowMode='local'|'server';

/** Select the workflow before resolving any signer or saved server profile. */
export function defaultGameWalletWorkflowMode(network:TestNetwork):GameWalletWorkflowMode {
 return network==='mutinynet'?'local':'server';
}
