import React, { useSyncExternalStore, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { AccountDialogShell } from '../../../integration/src/client/ui-layer-react/AccountCard.tsx';
import { GameWalletLoginView } from '../../../integration/src/client/ui-layer-react/GameWalletLogin.tsx';
import { createLocalGameWallet } from '../../../integration/src/client/state-layer-core/game-wallet.ts';
import { createServerFirstStorage, createServerProfileMemory } from '../../../integration/src/client/state-layer-core/server-first-game-wallet.ts';
import { configureBisServer } from '../../../integration/src/client/wallet-layer-arkade/server-wallet.ts';

// An explicit test-only destination. Tests intercept it; no production credential
// or endpoint is read from query parameters, local storage or fixture source.
if (new URL(location.href).searchParams.has('owner-test')) configureBisServer({ url: 'https://owner.fixture.test/api/bis/' });
const selectionTest = new URL(location.href).searchParams.has('selection-test');
if (selectionTest) configureBisServer({ url: 'https://selection.fixture.test/api/bis/' });

// Deterministic UI-only provider data. Signing requests use the real local API.
let saved = null;
const backend = createServerFirstStorage({ load: async () => saved, select: async account => { saved = account; }, logout: async () => { saved = null; }, reset: async () => { saved = null; }, subscribe: () => () => {}, dispose() {} }, () => 'signet', undefined, createServerProfileMemory(localStorage));
const wallet = createLocalGameWallet({ playerProfileId: () => 'fixture-player', playerNetwork: () => 'signet' }, {
  storage: backend.storage, source: backend.source, probe: backend.refresh,
  ...(selectionTest ? {selectForOperation:(account,requirement,signal,current)=>backend.selectForOperation(account,requirement,signal,current)} : {}),
  restore: async () => { throw Error('Fixture does not restore real wallets.'); },
  addresses: async () => ({ arkadeAddress: 'tark1fixture', bitcoinAddress: 'tb1fixture' }),
  balance: async account => {
    const availableSats = selectionTest ? ((globalThis as typeof globalThis & {__bisSelectionBalances?:Record<string,number>}).__bisSelectionBalances?.[account.profileId] ?? 0) : 0;
    return {availableSats,totalSats:availableSats,arkadeSats:availableSats,bitcoinSats:0,availableBitcoinSats:0,availableArkadeSats:availableSats};
  }, watch: undefined,
});
function Host() {
  const state = useSyncExternalStore(wallet.subscribe, wallet.getState, wallet.getState), heading = useRef(null);
  return <AccountDialogShell title="Game Wallet" description="Deterministic UI verification" headingRef={heading} network="Signet" serverConnected={state.source === 'server' && state.serverStatus === 'connected'}><GameWalletLoginView wallet={wallet} onBack={() => {}} /></AccountDialogShell>;
}
createRoot(document.getElementById('root')!).render(<Host />);
