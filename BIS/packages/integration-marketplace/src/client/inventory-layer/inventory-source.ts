import type { TestNetwork } from '@bis/integration';

/** A connected Game Wallet overrides public catalog configuration only for this session. */
export function marketplaceGameInventoryAddress(input: Readonly<{registeredAddress?: string; playerProfileId?: string; gameProfileId?: string; sessionAddress?: string; network?: TestNetwork; gameNetwork?: TestNetwork}>): string | undefined {
  return input.playerProfileId && input.gameProfileId && input.network && input.gameNetwork === input.network
    ? input.sessionAddress
    : input.registeredAddress;
}
