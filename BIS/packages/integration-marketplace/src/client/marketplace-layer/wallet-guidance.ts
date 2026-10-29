export type MarketplaceWalletGuidance = Readonly<{
  description: string;
  listing: string;
  sales: string;
}>;

export function marketplaceWalletGuidance(input: {
  hostedGameWallet: boolean;
  gameListingEnabled: boolean;
  salesEnabled: boolean;
}): MarketplaceWalletGuidance {
  const { hostedGameWallet, gameListingEnabled, salesEnabled } = input;
  return {
    description: hostedGameWallet
      ? 'The connected BIS server controls the Game Wallet. A separate Game Wallet Login is not required.'
      : 'For the manual wallet flow, log in to a separate Game Wallet.',
    listing: gameListingEnabled
      ? `Requirement complete: the ${hostedGameWallet ? 'server Game Wallet is connected' : 'Game Wallet is logged in'} and has items to display.`
      : hostedGameWallet
        ? 'Requirement: connect the Player Wallet and make the server Game Wallet inventory available.'
        : 'Requirement: log in to a Player Wallet and a separate Game Wallet with items to display.',
    sales: salesEnabled
      ? `Requirement complete: separate Player and ${hostedGameWallet ? 'server Game' : 'Game'} Wallets are available.`
      : hostedGameWallet
        ? 'Requirement: connect the Player Wallet and ensure the server Game Wallet is available.'
        : 'Requirement: log in to separate Player and Game Wallets from Account.',
  };
}
