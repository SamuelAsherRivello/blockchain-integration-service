import { ReadonlyWallet, MnemonicIdentity, RestArkProvider, EsploraProvider, InMemoryWalletRepository, InMemoryContractRepository } from '@arkade-os/sdk';
import { createAccountStorage } from '../../integration/src/core/account-storage';
import { SIGNET_OPERATOR, requireSignet } from '../../integration/src/arkade/account';

const result = document.getElementById('result')!;
let wallet: ReadonlyWallet | undefined;
let stop: (() => void) | undefined;
document.getElementById('run')!.onclick = async () => {
  result.textContent = 'Reading SDK history…';
  try {
    stop?.(); await wallet?.dispose();
    const { account } = await createAccountStorage().load();
    if (!account) { result.textContent = 'No saved account in this browser origin.'; return; }
    const provider = new RestArkProvider(SIGNET_OPERATOR);
    requireSignet((await provider.getInfo()).network);
    wallet = await ReadonlyWallet.create({ identity: MnemonicIdentity.fromMnemonic(account.phrase, { isMainnet: false }), arkProvider: provider, onchainProvider: new EsploraProvider('https://mempool.space/signet/api', { forcePolling: true, pollingInterval: 15000 }), storage: { walletRepository: new InMemoryWalletRepository(), contractRepository: new InMemoryContractRepository() } });
    const [history, coins] = await Promise.all([wallet.getTransactionHistory(), wallet.getBoardingUtxos()]);
    result.textContent = JSON.stringify({ history, coins: coins.map(c => ({ txid: c.txid, vout: c.vout, value: c.value, confirmed: c.status.confirmed })), connection: wallet.getProviderConnectionState() }, null, 2);
    stop = await wallet.notifyIncomingFunds(event => { result.textContent += '\nSDK notification: ' + event.type; });
    result.textContent += '\nSubscription registered (not proof of a live event).';
  } catch { result.textContent = 'SDK read failed. No credentials displayed.'; }
};
window.addEventListener('pagehide', () => { stop?.(); void wallet?.dispose(); });
