import type { BisContractActionResult, BisContractRequest, BisContractState, BisSnapshot, IBis, TestNetwork } from '@bis/integration';
import { contractValidationOptions } from '../../../integration/src/client/state-layer-core/contract-validation.ts';

export const TREASURE_DEMO_GAME_ID = 'bis-prototype-treasure-demo';
export const TREASURE_OFFER_AMOUNT_SATS = 1_000;
export const TREASURE_OFFER_DURATION_SECONDS = 90;

export function treasurePlayerReadiness(snapshot: BisSnapshot, selectedNetwork: TestNetwork) {
  const player = snapshot.account.playerWallet;
  if (snapshot.disposed) return { ready: false as const, reason: 'BIS is unavailable.' };
  if (snapshot.account.phase !== 'active' || !player?.profileId) return { ready: false as const, reason: 'Create or restore a BIS Player account.' };
  const playerNetwork = player.network ?? snapshot.account.network;
  if (playerNetwork !== selectedNetwork) return { ready: false as const, reason: `Select ${selectedNetwork} in the BIS Account network picker.` };
  return { ready: true as const, network: playerNetwork, playerId: player.profileId };
}

export function treasureProfileReadiness(snapshot: BisSnapshot, selectedNetwork: TestNetwork) {
  const player = treasurePlayerReadiness(snapshot, selectedNetwork);
  if (!player.ready) return player;
  const game = snapshot.account.gameWallet;
  if (!game?.profileId) return { ready: false as const, reason: 'Setup Wallet 2 has not been restored as the BIS Game Wallet yet.' };
  const gameNetwork = game.network ?? snapshot.account.network;
  if (player.network !== gameNetwork) return { ready: false as const, reason: 'Select Player and Game Wallet profiles on the same network.' };
  if (gameNetwork !== selectedNetwork) return { ready: false as const, reason: `Select ${selectedNetwork} in the BIS Account network picker.` };
  if (!snapshot.capabilities.contracts.available) return { ready: false as const, reason: snapshot.capabilities.contracts.reason || 'BIS contract support is unavailable.' };
  return { ready: true as const, network: player.network, playerId: player.playerId, gameId: game.profileId };
}

export function treasureStartRequest(validationMode: NonNullable<BisContractRequest['validationMode']>, now = Date.now(), id = crypto.randomUUID()): BisContractRequest {
  const startedAt = now;
  return {
    offerSessionId: id,
    purpose: 'treasureLTO',
    hostReference: `treasure:${id}`,
    amountSats: TREASURE_OFFER_AMOUNT_SATS,
    startedAt,
    expiresAt: (Math.floor(startedAt / 1000) + TREASURE_OFFER_DURATION_SECONDS) * 1000,
    exclusivityKey: 'treasure',
    validationMode,
  };
}

export type TreasureCheckState = 'no-offer' | 'pending' | 'claimable' | 'claiming' | 'rejecting' | 'expired' | 'rejected' | 'claimed' | 'unknown' | 'unavailable';
export type TreasureCheckResult = Readonly<{ status: TreasureCheckState; message: string; contract?: BisContractState }>;

export function treasureContractState(contract: BisContractState): TreasureCheckState {
  if (contract.recoveryRequired) return 'unknown';
  if (contract.financial === 'failed') return 'no-offer';
  if (contract.financial === 'claimed') return 'claimed';
  if (contract.financial === 'refunded') return 'rejected';
  if (contract.financial === 'claiming') return 'claiming';
  if (contract.financial === 'refunding') return 'rejecting';
  if (contract.financial === 'unknown') return 'unknown';
  if (contract.financial === 'funding') return 'pending';
  if (contract.financial === 'funded' && contract.eligibility === 'expired') return 'expired';
  if (contract.financial === 'funded' && contract.eligibility === 'within-window' && (contract.canClaim || contract.canReject)) return 'claimable';
  if (contract.financial === 'funded') return 'pending';
  return 'unknown';
}

const treasureFilter = (gameId: string) => ({ purpose: 'treasureLTO', exclusivityKey: 'treasure', gameId, includeResolved: true });

function matchesTreasureContract(contract: BisContractState, network: TestNetwork, playerId: string, gameId: string) {
  return contract.purpose === 'treasureLTO' && contract.scope.network === network &&
    contract.scope.playerId === playerId && contract.scope.gameId === gameId &&
    contract.scope.exclusivityKey === 'treasure' && contract.hostReference.startsWith('treasure:');
}

/** checkContractsAsync performs BIS/operator reconciliation before returning contract state. */
export async function checkTreasureContract(service: Pick<IBis, 'checkContractsAsync'>, snapshot: BisSnapshot, network: TestNetwork): Promise<TreasureCheckResult> {
  const readiness = treasureProfileReadiness(snapshot, network);
  if (!readiness.ready) return { status: 'unavailable', message: readiness.reason };
  let result;
  try { result = await service.checkContractsAsync(treasureFilter(readiness.gameId)); }
  catch { return { status: 'unavailable', message: 'BIS could not verify Treasure Hunt state with the current operator. Retry Check.' }; }
  if (result.status !== 'ready') return { status: 'unavailable', message: 'BIS contract evidence is unavailable. Retry Check before acting.' };
  const matches = result.contracts.filter(contract => matchesTreasureContract(contract, network, readiness.playerId, readiness.gameId));
  if (matches.length === 0) return { status: 'no-offer', message: 'No Treasure Hunt contract was returned for the selected Player and Game Wallets.' };
  const unresolved = matches.filter(contract => !['claimed', 'refunded', 'failed'].includes(contract.financial) || contract.recoveryRequired);
  if (unresolved.length > 1) return { status: 'unknown', message: 'More than one unresolved Treasure Hunt contract matches these wallets. The result is ambiguous; do not submit another action.' };
  const contract = unresolved[0] ?? matches.reduce((latest, candidate) => candidate.startedAt > latest.startedAt ? candidate : latest);
  const status = treasureContractState(contract);
  return { status, contract, message: status === 'no-offer' ? 'The previous Treasure Hunt offer was not submitted.'
    : status === 'claimed' ? 'Treasure contract claim is verified.'
    : status === 'rejected' ? 'Treasure contract refund is verified.'
      : status === 'claimable' ? 'The matching Treasure Hunt contract is funded and claimable.'
        : status === 'expired' ? 'The contract deadline has passed. Check its refund state before taking another action.'
          : status === 'unknown' ? 'The matching contract remains unresolved. Check again before acting.'
            : 'The matching Treasure Hunt contract is still pending.' };
}

export async function startTreasureContract(service: Pick<IBis, 'startContractAsync' | 'checkContractsAsync'>, snapshot: BisSnapshot, network: TestNetwork, validationMode: NonNullable<BisContractRequest['validationMode']>): Promise<BisContractActionResult> {
  const readiness = treasureProfileReadiness(snapshot, network);
  if (!readiness.ready) throw new Error(readiness.reason);
  if (!validationMode || !contractValidationOptions(network).includes(validationMode)) throw new Error(`No supported contract validation mode is available on ${network}.`);
  const current = await checkTreasureContract(service, snapshot, network);
  if (current.status === 'unavailable' || current.status === 'unknown') throw new Error(current.message);
  if (current.contract && !['no-offer', 'claimed', 'rejected'].includes(current.status)) return { status: 'already-taken', contract: current.contract };
  return service.startContractAsync(treasureStartRequest(validationMode));
}

export async function actOnTreasureContract(service: Pick<IBis, 'checkContractsAsync' | 'claimContractAsync' | 'rejectContractAsync'>, snapshot: BisSnapshot, network: TestNetwork, action: 'claim' | 'reject'): Promise<{ check: TreasureCheckResult; result?: BisContractActionResult }> {
  const checked = await checkTreasureContract(service, snapshot, network);
  const contract = checked.contract;
  if (!contract || checked.status !== 'claimable' || (action === 'claim' ? !contract.canClaim : !contract.canReject)) return { check: checked };
  const result = action === 'claim' ? await service.claimContractAsync(contract.id) : await service.rejectContractAsync(contract.id);
  return { check: checked, result };
}
