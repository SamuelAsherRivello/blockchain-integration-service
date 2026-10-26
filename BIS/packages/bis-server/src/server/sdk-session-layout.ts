import type { Identity, SignerSession } from '@arkade-os/sdk';

// SDK 0.4.79 private layout. Any upgrade must requalify this codec. The public
// SDK creates random session keys, so wallet-key derivation alone cannot bind
// its session key. Never use this helper on an initialized/borrowed session.
export const SDK_SESSION_FIELDS = ['secretKey', 'myNonces', 'aggregateNonces', 'graph', 'scriptRoot', 'rootSharedOutputAmount'].sort().join(',');
export function boundSdkSession(identity: Pick<Identity, 'signerSession'>, privateKey: Uint8Array): SignerSession {
  const signer = identity.signerSession() as SignerSession & Record<string, any>;
  if (!(privateKey instanceof Uint8Array) || privateKey.length !== 32 || Object.keys(signer).sort().join(',') !== SDK_SESSION_FIELDS ||
      !(signer.secretKey instanceof Uint8Array) || signer.secretKey.length !== 32 ||
      ['myNonces', 'aggregateNonces', 'graph', 'scriptRoot', 'rootSharedOutputAmount'].some(key => signer[key] !== null)) throw Error('Unsupported SDK signing-state layout.');
  signer.secretKey.fill(0);
  signer.secretKey = Uint8Array.from(privateKey);
  return signer;
}
