import { useState } from 'react';
import type { TestNetwork } from '../../../integration/src/client/state-layer-core/test-network.ts';
import { demoGetInput } from './navigation.ts';
import { cleanWallet2 } from './wallet-maintenance.ts';

export function CleanWalletControl({ network }: { network: TestNetwork }) {
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);
  async function clean() {
    if (running) return;
    const mnemonic = demoGetInput(network, 'wallet-2-mnemonic');
    setRunning(true);
    setFailed(false);
    try { setMessage(await cleanWallet2(network, mnemonic, setMessage)); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Wallet cleanup could not finish.'); setFailed(true); }
    finally { setRunning(false); }
  }
  return <div className="sandbox-clean-wallet">
    <button className="sandbox-action-button" type="button" disabled={running} onClick={clean} title="Finish pending work and recover eligible funds using the submitted Wallet 2 mnemonic.">Clean Wallet 2</button>
    <span role="status" aria-live="polite" className={failed ? 'sandbox-clean-wallet-error' : undefined}>{message}</span>
  </div>;
}
