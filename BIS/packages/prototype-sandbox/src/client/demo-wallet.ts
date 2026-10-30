import type { Wallet } from '@arkade-os/sdk';
import type { TestNetwork } from '../../../integration/src/client/state-layer-core/test-network.ts';
import { demoGetInput } from './navigation.ts';
import { demoCreateWallet, type DemoWalletOptions } from './demos/create-wallet.ts';
export { demoCreateWallet };
export type { DemoWalletOptions };

export async function demoRefreshWallet(wallet: Pick<Wallet, 'getContractManager' | 'getVtxos'>) {
    const contractManager = await wallet.getContractManager();
    await contractManager.refreshVtxos();
    return wallet.getVtxos();
}

export function demoGetMnemonic(network: TestNetwork) {
    const mnemonic = demoGetInput(network, 'wallet-2-mnemonic');
    if (!mnemonic.trim())
        throw new Error('Enter Wallet 2 Mnemonic on Setup Input first.');
    return mnemonic;
}

export async function demoWithFreshWallet<T>(network: TestNetwork, operation: (wallet: Wallet) => Promise<T>, options?: DemoWalletOptions) {
    for (let attempt = 0; attempt < 2; attempt++) {
        // See Create Wallet demo for more info
        const wallet = await demoCreateWallet(network, options);
        try {
            return await operation(wallet);
        }
        catch (error) {
            if (!String(error instanceof Error ? error.message : error).includes('VTXO_NOT_FOUND') || attempt === 1)
                throw error;
        }
        finally {
            try {
                await wallet.dispose();
            }
            catch { /* Preserve the operation result. */ }
        }
        await new Promise(resolve => setTimeout(resolve, 250));
    }
    throw new Error('Wallet retry exhausted.');
}
