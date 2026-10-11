import { BoardingContractHandler, DefaultVtxo, getNetwork, timelockToSequence, type ArkInfo, type ReadonlyIdentity } from '@arkade-os/sdk';
import { requireNetwork } from './account.ts';
import type { TestNetwork } from '../state-layer-core/test-network.ts';
import type { AccountAddresses } from './addresses.ts';

/** Primary-address projection only: no wallet, provider ownership read, or signer. */
export async function projectConfiguredAddresses(identity: ReadonlyIdentity, info: ArkInfo, expected: TestNetwork): Promise<AccountAddresses> {
  requireNetwork(info.network, expected);
  const pubKey = await identity.xOnlyPublicKey();
  const signer = info.signerPubkey;
  if (!pubKey || !/^(?:[0-9a-f]{64}|0[23][0-9a-f]{64})$/i.test(signer)) throw Error('Invalid address configuration.');
  const serverPubKey = Uint8Array.from(signer.slice(-64).match(/../g)!, byte => parseInt(byte, 16));
  const delay = info.unilateralExitDelay, boardingDelay = info.boardingExitDelay;
  if (delay < 0n || boardingDelay < 0n) throw Error('Invalid address timelock.');
  const network = getNetwork(expected);
  const script = new DefaultVtxo.Script({pubKey, serverPubKey, csvTimelock:{value:delay, type:delay < 512n ? 'blocks' : 'seconds'}});
  // SDK BoardingContractHandler accepts the encoded BIP68 sequence. It uses
  // the same delay classification as SDK setupWalletConfig.
  const sequence = timelockToSequence({value:boardingDelay, type:boardingDelay < 512n ? 'blocks' : 'seconds'});
  const hex = (bytes: Uint8Array) => Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  const boarding = BoardingContractHandler.createScript({pubKey:hex(pubKey), serverPubKey:hex(serverPubKey), csvTimelock:sequence.toString()});
  const arkadeAddress = script.address(network.hrp, serverPubKey).encode();
  const bitcoinAddress = boarding.onchainAddress(network);
  if (!arkadeAddress.startsWith('tark1') || !bitcoinAddress.startsWith('tb1')) throw Error('Unexpected address network.');
  return Object.freeze({arkadeAddress, bitcoinAddress});
}
