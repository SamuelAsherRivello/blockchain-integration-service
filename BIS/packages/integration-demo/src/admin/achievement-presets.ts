// Public metadata URLs must stay absolute, including when minting from localhost.
// Preserve published versions: mint metadata can retain these URLs after future releases.
export const achievementPresets = [1, 2, 3].map(level => ({
  name: `Achievement: Level ${level}`,
  ticker: `LVL${level}`,
  amount: '1',
  decimals: 0,
  iconUrl: `https://samuelasherrivello.github.io/blockchain-integration-service/assets/achievements/v2/level-${level}-trophy.png`,
}));
