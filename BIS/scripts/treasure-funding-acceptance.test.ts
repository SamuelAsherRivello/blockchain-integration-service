import test from 'node:test';
import assert from 'node:assert/strict';
import { validateSignetTreasureConsent } from './test-wallets/treasure-funding-acceptance.ts';

const now = 1_800_000_000_000;
const eligible = { status: 'awaiting-consent', network: 'signet', amountSats: 1000, playerId: 'player', gameId: 'game',
  gameSource: 'server', startedAt: now, expiresAt: (Math.floor(now / 1000) + 90) * 1000,
  fundingConsentOpen: true, visibleCopy: 'Lock 1,000 sats from your selected Game Wallet on Signet for this treasure offer?' };

test('Signet treasure acceptance requires exact approved wallet identity, amount, source, copy and live expiry', () => {
  assert.deepEqual(validateSignetTreasureConsent(eligible, { playerId: 'player', gameId: 'game', now }),
    { network: 'signet', amountSats: 1000, remainingSeconds: 90 });
  for (const patch of [{ network: 'mutinynet' }, { amountSats: 5001 }, { playerId: 'other' }, { gameSource: 'manual' },
    { visibleCopy: 'Lock sats?' }, { fundingConsentOpen: false }, { expiresAt: now }, { status: 'active' }])
    assert.throws(() => validateSignetTreasureConsent({ ...eligible, ...patch }, { playerId: 'player', gameId: 'game', now }),
      /treasure-consent-not-approved-for-acceptance/);
  assert.throws(() => validateSignetTreasureConsent(eligible, { playerId: 'other', gameId: 'game', now }),
    /treasure-consent-not-approved-for-acceptance/);
});
