import type { BisAssetDeliveryRequest, BisAssetDeliveryResult, BisMintAssetRequest, BisMintAssetResult, BisPendingAssetDeliveryResult, BisPendingMintResult } from '@bis/integration';

export type MintDestination = 'player' | 'game';
export type MintWallet = {
  getState(): { profileId?: string; phase?: string; network?: string; addresses?: { status?: string; arkadeAddress?: string } };
  getPaymentRecipient?(): Promise<{ profileId: string; address: string }>;
  subscribe(listener: () => void): () => void;
  getPendingAssetMint(): Promise<BisPendingMintResult>;
  getPendingAssetDelivery?(): Promise<BisPendingAssetDeliveryResult>;
  mintAsset(request: BisMintAssetRequest): Promise<BisMintAssetResult>;
  deliverAsset?(request: BisAssetDeliveryRequest): Promise<BisAssetDeliveryResult>;
  checkAssetDelivery?(operationId: string): Promise<BisAssetDeliveryResult>;
};
export type PreparedMintDestination = {
  destination: MintDestination;
  sourceProfileId: string;
  destinationProfileId: string;
  request: BisMintAssetRequest | null;
  canMint: true;
  reason: string | undefined;
  isCurrent(): boolean;
  subscribe(listener: () => void): () => void;
  mint(request: BisMintAssetRequest): Promise<BisMintAssetResult>;
};

export function prepareMintDestination(destination: MintDestination, source: MintWallet | undefined, recipient: MintWallet | undefined,
  current: () => boolean, log: (result: unknown) => void): Promise<PreparedMintDestination>;
/** @deprecated Test seams and older Marketplace callers may pass one wallet; production C.G.1 always uses the five-argument form. */
export function prepareMintDestination(destination: MintDestination, source: MintWallet | undefined,
  current: () => boolean, log: (result: unknown) => void): Promise<PreparedMintDestination>;
export async function prepareMintDestination(destination: MintDestination, source: MintWallet | undefined,
  recipientOrCurrent: MintWallet | (() => boolean) | undefined, currentOrLog: (() => boolean) | ((result: unknown) => void), maybeLog?: (result: unknown) => void): Promise<PreparedMintDestination> {
  const legacy = typeof recipientOrCurrent === 'function';
  const recipient = legacy ? source : recipientOrCurrent;
  const current = (legacy ? recipientOrCurrent : currentOrLog) as () => boolean;
  const log = (legacy ? currentOrLog : maybeLog) as (result: unknown) => void;
  const sourceProfileId = source?.getState().profileId;
  const destinationWallet = destination === 'player' ? recipient : source;
  const destinationProfileId = destinationWallet?.getState().profileId;
  if (!source || !sourceProfileId) throw Error(legacy && destination === 'player' ? 'Log in to a player wallet first.' : 'Import a game wallet first.');
  if (!destinationWallet || !destinationProfileId) throw Error('Log in to a player wallet first.');
  const sourceNetwork=source.getState().network,destinationNetwork=destinationWallet.getState().network;
  if(sourceNetwork&&destinationNetwork&&sourceNetwork!==destinationNetwork)throw Error('The Game Wallet must match the Player Wallet network.');
  const isCurrent = () => current() && source.getState().profileId === sourceProfileId && destinationWallet.getState().profileId === destinationProfileId
    && source.getState().network===sourceNetwork && destinationWallet.getState().network===destinationNetwork;
  const pending = await source.getPendingAssetMint();
  if (!isCurrent()) throw Error('The selected wallet changed. Close and reopen Mint Asset.');
  if (pending.status === 'error') throw Error(pending.message);
  if (pending.profileId !== sourceProfileId) throw Error('The selected wallet changed. Close and reopen Mint Asset.');
  const pendingDelivery = source.getPendingAssetDelivery ? await source.getPendingAssetDelivery() : undefined;
  if (pendingDelivery?.status === 'error') throw Error(pendingDelivery.message);
  if (!isCurrent() || pendingDelivery && pendingDelivery.profileId !== sourceProfileId) throw Error('The selected wallet changed. Close and reopen Mint Asset.');
  let destinationAddress: string | undefined;
  if (destination === 'player' && !legacy) {
    try {
      const resolved = recipient?.getPaymentRecipient ? await recipient.getPaymentRecipient() : undefined;
      if (resolved) {
        if (resolved.profileId !== destinationProfileId || !resolved.address) throw Error('The Player Wallet receiving address is unavailable.');
        destinationAddress = resolved.address;
      } else {
        const address = destinationWallet.getState().addresses;
        if (!address || address.status !== 'ready' || !address.arkadeAddress) throw Error('The Player Wallet receiving address is unavailable.');
        destinationAddress = address.arkadeAddress;
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('Player Wallet')) throw error;
      throw Error('The Player Wallet receiving address is unavailable.');
    }
    if (!isCurrent()) throw Error('The selected wallet changed. Close and reopen Mint Asset.');
  }
  const recoveryDelivery = destination === 'player' && !legacy && pendingDelivery?.request ? pendingDelivery : undefined;
  if (recoveryDelivery && (!recoveryDelivery.mintRequest ||
      recoveryDelivery.request!.operationId !== `${recoveryDelivery.mintRequest.operationId}-delivery` ||
      recoveryDelivery.request!.recipient !== destinationAddress ||
      pending.request && JSON.stringify(pending.request) !== JSON.stringify(recoveryDelivery.mintRequest)))
    throw Error('The original item delivery needs recovery. Keep its recipient and operation unchanged.');
  const recoveryRequest = pending.request ?? recoveryDelivery?.mintRequest ?? null;
  let busy = false;
  return {
    destination, sourceProfileId, destinationProfileId, request: recoveryRequest, canMint:true, reason:undefined as string | undefined, isCurrent,
    subscribe(listener: () => void) { const offSource = source.subscribe(listener); const offDestination = destinationWallet === source ? () => {} : destinationWallet.subscribe(listener); return () => { offSource(); offDestination(); }; },
    async mint(request: BisMintAssetRequest): Promise<BisMintAssetResult> {
      if (!isCurrent()) return {status: 'error', code: 'account-changed', message: 'The selected wallet changed. Close and reopen Mint Asset.'};
      if (recoveryRequest && JSON.stringify(request) !== JSON.stringify(recoveryRequest)) return {status:'error',code:'outcome-unknown',message:'Resume the original mint and item delivery without changing its request.'};
      if (busy) return {status: 'error', code: 'busy', message: 'Mint already in progress.'};
      busy = true;
      const report = (result: unknown) => { if (isCurrent()) log({source:'game', destination, profileId:legacy ? destinationProfileId : sourceProfileId, sourceProfileId, destinationProfileId, operationId: request.operationId, result}); };
      report({status: 'pending'});
      try {
        const result = await source.mintAsset(request);
        if (!isCurrent()) return {status: 'error', code: 'account-changed', message: 'The selected wallet changed. Close and reopen Mint Asset.'};
        if (result.status === 'error' || destination === 'game' || legacy) { report(result); return result; }
        if (!destinationAddress || !source.deliverAsset) {
          const unavailable = {status:'error', code:'unavailable', message:'The Player Wallet receiving address is unavailable.'} as const;
          report(unavailable); return unavailable;
        }
        const delivery: BisAssetDeliveryRequest = {operationId:`${request.operationId}-delivery`,assetId:result.asset.assetId,quantity:result.asset.quantity,recipient:destinationAddress};
        // A completed mint can outlive its unresolved delivery. Recover that
        // exact journal with the read-only checker, including in the same dialog
        // after an acknowledgement was lost; never send a replacement delivery.
        const latest = source.getPendingAssetDelivery ? await source.getPendingAssetDelivery() : undefined;
        if (!isCurrent()) return {status:'error',code:'account-changed',message:'The selected wallet changed. Close and reopen Mint Asset.'};
        if (latest?.status === 'error') {report(latest);return {status:'error',code:'outcome-unknown',message:latest.message};}
        if (latest && latest.profileId !== sourceProfileId) return {status:'error',code:'account-changed',message:'The selected wallet changed. Close and reopen Mint Asset.'};
        const saved = recoveryDelivery?.request ?? latest?.request;
        if (saved && (saved.operationId !== delivery.operationId || saved.assetId !== delivery.assetId || saved.quantity !== delivery.quantity || saved.recipient !== delivery.recipient)) {
          const error={status:'error',code:'outcome-unknown',message:'The original item delivery needs recovery. Keep its recipient and operation unchanged.'} as const;report(error);return error;
        }
        const delivered = saved
          ? source.checkAssetDelivery ? await source.checkAssetDelivery(saved.operationId) : {status:'error',code:'outcome-unknown',message:'Item delivery status is unavailable. Do not submit another delivery.'} as const
          : await source.deliverAsset(delivery);
        if (!isCurrent()) return {status:'error',code:'account-changed',message:'The selected wallet changed. Close and reopen Mint Asset.'};
        if (delivered.status === 'error') {
          const error = {status:'error',code:delivered.code === 'outcome-unknown' ? 'outcome-unknown' : 'unavailable',message:delivered.message} as const;
          report({mint:result,delivery:error}); return error;
        }
        const completed = {...result, transactionId: result.transactionId};
        report({mint:completed,delivery:delivered});
        return completed;
      } catch {
        // A thrown submission is not proof that nothing was issued.
        const result = {status: 'error', code: 'outcome-unknown', message: 'Mint outcome unknown. Check mint status.'} as const;
        report(result);
        return result;
      } finally { busy = false; }
    },
  };
}
