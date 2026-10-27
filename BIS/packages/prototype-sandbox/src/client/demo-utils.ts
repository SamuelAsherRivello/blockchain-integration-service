import { ArkAddress } from '@arkade-os/sdk';
import { testNetwork as demoGetNetwork } from '../../../integration/src/client/state-layer-core/test-network.ts';
import type { TestNetwork } from '../../../integration/src/client/state-layer-core/test-network.ts';

// Keep the shared integration API name unchanged outside the sandbox.
export { demoGetNetwork };

export function demoEncodeHex(bytes: Uint8Array) {
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

/** Accept an SDK-decoded address or its string form, never a precomputed script. */
export function demoGetVtxosUrl(network: TestNetwork, address: string | ArkAddress) {
  const decoded = typeof address === 'string' ? ArkAddress.decode(address) : address;
  const script = demoEncodeHex(decoded.pkScript);
  return `${demoGetNetwork(network).operator}/v1/indexer/vtxos?scripts=${encodeURIComponent(script)}`;
}
