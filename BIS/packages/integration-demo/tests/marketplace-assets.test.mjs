import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { achievementPresets } from '../src/admin/achievement-presets.ts';
import { marketplaceCatalogItems } from '../src/admin/marketplace-catalog.ts';

test('every immutable marketplace URL has a valid checked-in PNG', async () => {
  assert.equal(marketplaceCatalogItems.length, 9);
  for (const item of marketplaceCatalogItems) {
    const fileName = new URL(item.iconUrl).pathname.split('/').at(-1);
    const filePath = fileURLToPath(new URL(`../public/assets/marketplace/v1/${fileName}`, import.meta.url));
    const png = await readFile(filePath);
    assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    assert.ok(png.readUInt32BE(16) > 0);
    assert.ok(png.readUInt32BE(20) > 0);
  }
});

test('C1 presets identify themselves as Stealth & Steel trophies', () => {
  assert.deepEqual(achievementPresets.map(preset => preset.metadata), [1, 2, 3].map(level => ({
    bisGameId: 'stealth-and-steel',
    bisAssetType: 'trophy',
    bisCatalogId: `stealth-steel-trophy-${level}`,
    bisTier: String(level),
  })));
});
