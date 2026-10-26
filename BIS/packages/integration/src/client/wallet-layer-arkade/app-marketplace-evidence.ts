import { ArkAddress } from '@arkade-os/sdk';
import type { WalletAccount } from './account.ts';
import { readAssetDeliveryRecord } from '../state-layer-core/asset-delivery.ts';
import { readLocalMarketplaceCheckout } from '../state-layer-core/marketplace-checkout.ts';

/** Private composition hint, never signing authority. The server independently
 * verifies the indexed payment, issuer, catalog price and one-time reservation.
 */
export function marketplacePaymentEvidence(account: WalletAccount, inputs: readonly { txid: string; vout: number }[], playerProfileId: string | undefined) {
  if (!('server' in account) || !playerProfileId) return;
  const delivery = readAssetDeliveryRecord(account.profileId, undefined, account.network ?? 'signet');
  if (!delivery) return;
  const source = (points: readonly { txid: string; vout: number }[]) => points.map(p => `${p.txid}:${p.vout}`).sort().join(',');
  if (source(delivery.inputs) !== source(inputs)) return;
  const checkout = readLocalMarketplaceCheckout(delivery.request.operationId);
  if (!checkout) return;
  const bytes = (value: Uint8Array) => Array.from(value, byte => byte.toString(16).padStart(2, '0')).join('');
  if (checkout.status !== 'pending' || checkout.phase !== 'delivery-submitted' || checkout.request.direction !== 'buy' ||
      checkout.request.game.profileId !== account.profileId || checkout.request.player.profileId !== playerProfileId ||
      checkout.request.player.address !== delivery.request.recipient || checkout.request.assetId !== delivery.request.assetId ||
      checkout.request.quantity !== delivery.request.quantity || checkout.request.quantity !== '1' ||
      bytes(ArkAddress.decode(checkout.request.game.address).pkScript) !== delivery.senderScript ||
      bytes(ArkAddress.decode(checkout.request.player.address).pkScript) !== delivery.recipientScript ||
      !checkout.paymentTransactionId) throw Error('Marketplace delivery evidence changed. Reconcile the original checkout.');
  return checkout.paymentTransactionId;
}
