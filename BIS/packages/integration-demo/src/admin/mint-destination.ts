import type { BisMintAssetRequest, BisMintAssetResult, BisPendingMintResult } from '@bis/integration';

export type MintDestination = 'player' | 'game';
export type MintWallet = {
  getState(): { profileId?: string };
  subscribe(listener: () => void): () => void;
  getPendingAssetMint(): Promise<BisPendingMintResult>;
  mintAsset(request: BisMintAssetRequest): Promise<BisMintAssetResult>;
};

export async function prepareMintDestination(destination: MintDestination, wallet: MintWallet | undefined,
  current: () => boolean, log: (result: unknown) => void) {
  const profileId = wallet?.getState().profileId;
  if (!wallet || !profileId) throw Error(destination === 'player' ? 'Log in to a player wallet first.' : 'Import a game wallet first.');
  const isCurrent = () => current() && wallet.getState().profileId === profileId;
  const pending = await wallet.getPendingAssetMint();
  if (!isCurrent()) throw Error('The selected wallet changed. Close and reopen Mint Asset.');
  if (pending.status === 'error') throw Error(pending.message);
  if (pending.profileId !== profileId) throw Error('The selected wallet changed. Close and reopen Mint Asset.');
  // Match production collection: the selected wallet's mintAsset method owns
  // current funding and reservation validation. Never veto it with a UI snapshot.
  let busy = false;
  return {
    destination, profileId, request: pending.request, canMint:true, reason:undefined as string | undefined, isCurrent,
    subscribe: wallet.subscribe.bind(wallet),
    async mint(request: BisMintAssetRequest): Promise<BisMintAssetResult> {
      if (!isCurrent()) return {status: 'error', code: 'account-changed', message: 'The selected wallet changed. Close and reopen Mint Asset.'};
      if (busy) return {status: 'error', code: 'busy', message: 'Mint already in progress.'};
      busy = true;
      const report = (result: unknown) => { if (isCurrent()) log({destination, profileId, operationId: request.operationId, result}); };
      report({status: 'pending'});
      try {
        const result = await wallet.mintAsset(request);
        if (!isCurrent()) return {status: 'error', code: 'account-changed', message: 'The selected wallet changed. Close and reopen Mint Asset.'};
        report(result);
        return result;
      } catch {
        // A thrown submission is not proof that nothing was issued.
        const result = {status: 'error', code: 'outcome-unknown', message: 'Mint outcome unknown. Check mint status.'} as const;
        report(result);
        return result;
      } finally { busy = false; }
    },
  };
}
export type PreparedMintDestination = Awaited<ReturnType<typeof prepareMintDestination>>;
