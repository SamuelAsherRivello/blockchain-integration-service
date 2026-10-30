import { RestArkProvider } from '@arkade-os/sdk';
import { validateArkadeAddress } from '../../../prototype-faucet/src/shared/faucet-core.ts';
import { walletCallbackUrl, walletPaymentUrl } from './navigation.ts';
import { demoGetNetwork } from './demo-utils.ts';

const EXTERNAL_WALLET_MESSAGE_SOURCE = 'bis-external-wallet';
const TERMINAL_FAILURES = ['cancelled', 'canceled', 'rejected', 'denied', 'failed', 'failure', 'expired', 'error'];
const TRANSACTION_ID = /^[a-f0-9]{64}$/i;

export function externalWalletPaymentResult(search: string) {
  const result = new URLSearchParams(search);
  const status = result.get('status')?.toLowerCase() || '';
  if (status === 'sent') {
    const txid = result.get('txid');
    return txid && TRANSACTION_ID.test(txid)
      ? [`Wallet result: sent`, `Transaction ID: ${txid}`, 'Success: true'].join('\n')
      : ['Wallet result: invalid or missing transaction ID', 'Success: false'].join('\n');
  }
  if (result.get('error')?.trim())
    return [`Wallet result: ${result.get('error')}`, 'Success: false'].join('\n');
  if (TERMINAL_FAILURES.includes(status))
    return [`Wallet result: ${status}`, 'Success: false'].join('\n');
  return '';
}

export function externalWalletPaymentVerifiedTerminal(search: string) {
  const result = new URLSearchParams(search);
  const status = result.get('status')?.toLowerCase() || '';
  return Boolean(result.get('error')?.trim()) || TERMINAL_FAILURES.includes(status) ||
    (status === 'sent' && TRANSACTION_ID.test(result.get('txid') || ''));
}

function externalWalletResultReady(search: string) {
  const result = new URLSearchParams(search);
  return externalWalletPaymentVerifiedTerminal(search) || result.has('address') || Boolean(result.get('error')?.trim());
}

export function notifyExternalWalletOpener() {
  // The same callback route handles both payment results and wallet-connect addresses.
  if (!window.opener || window.opener === window || !externalWalletResultReady(window.location.search)) return false;
  window.opener.postMessage({ source: EXTERNAL_WALLET_MESSAGE_SOURCE, search: window.location.search }, window.location.origin);
  try { window.close(); } catch { /* The opener may still close its child window. */ }
  return true;
}

export async function demoExternalWalletPayment({ network, recipientAddress, amountSats, walletWindow }: {
  network: 'signet' | 'mutinynet';
  recipientAddress: string;
  amountSats: string;
  walletWindow?: Window | null;
}) {
  if (!walletWindow || walletWindow.closed)
    throw new Error('The external wallet window was blocked. Allow popups for this page and try again.');

  return new Promise<string>((resolve, reject) => {
    let settled = false;
    let timeout: number | undefined;
    let closePoll: number | undefined;

    const closeWalletWindow = () => {
      if (walletWindow.closed) return;
      try { walletWindow.close(); } catch { /* Browser policy may refuse script closure. */ }
    };
    const cleanup = () => {
      if (timeout !== undefined) window.clearTimeout(timeout);
      if (closePoll !== undefined) window.clearInterval(closePoll);
      window.removeEventListener('message', receiveResult);
    };
    const finish = (error?: Error, txid?: string, close = false) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (close) closeWalletWindow();
      if (error) reject(error);
      else resolve(txid!);
    };
    const receiveResult = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== walletWindow || event.data?.source !== EXTERNAL_WALLET_MESSAGE_SOURCE || typeof event.data.search !== 'string') return;
      handleResult(event.data.search);
    };
    const handleResult = (search: string) => {
      const output = externalWalletPaymentResult(search);
      if (!output) return;
      const params = new URLSearchParams(search);
      const txid = params.get('txid') || '';
      const status = params.get('status')?.toLowerCase() || '';
      if (status === 'sent' && TRANSACTION_ID.test(txid)) finish(undefined, txid, true);
      else if (externalWalletPaymentVerifiedTerminal(search)) finish(new Error(output.split('\n')[0].replace(/^Wallet result: /, 'External wallet result: ')), undefined, true);
      else finish(new Error('External wallet returned an invalid or missing transaction ID.'), undefined, false);
    };

    window.addEventListener('message', receiveResult);
    timeout = window.setTimeout(() => finish(new Error('External wallet approval timed out. No transaction result was received.')), 120_000);
    closePoll = window.setInterval(() => {
      if (walletWindow.closed) {
        finish(new Error('External wallet window closed without a transaction result.'));
        return;
      }
      try { handleResult(new URL(walletWindow.location.href).search); }
      catch { /* The wallet is cross-origin until it redirects back to this demo. */ }
    }, 1000);

    void (async () => {
      try {
        const provider = new RestArkProvider(demoGetNetwork(network).operator);
        const info = await provider.getInfo();
        if (settled) return;
        validateArkadeAddress(recipientAddress, info, network);
        const link = walletPaymentUrl({ network, address: recipientAddress, amountSats, callback: walletCallbackUrl(window.location.href) });
        if (!walletWindow.closed) walletWindow.location.href = link;
        else finish(new Error('External wallet window closed before opening.'));
      } catch (error) {
        finish(error instanceof Error ? error : new Error(String(error)));
      }
    })();
  });
}
