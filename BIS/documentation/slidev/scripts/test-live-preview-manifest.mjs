import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { canonicalSlideRouteFor, editorOwnerForPath, landingLabelFor, livePreviewManifest, normalizedBase, publicPreviews, validateLivePreviewManifest, visiblePreviews } from './live-preview-manifest.mjs'

const packageScripts = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')).scripts

test('checked-in live preview inventory validates', () => {
  assert.equal(validateLivePreviewManifest(livePreviewManifest, packageScripts).valid, true)
})

test('manifest preflight maps every declared deck to its package script, landing route, and proxy owner', async () => {
  for (const entry of livePreviewManifest) {
    assert.ok(packageScripts[entry.script], `${entry.id}: missing package script ${entry.script}`)
    assert.equal(editorOwnerForPath(canonicalSlideRouteFor(entry)), entry, `${entry.id}: proxy route has the wrong owner`)
  }
  for (const entry of visiblePreviews()) {
    assert.match(canonicalSlideRouteFor(entry), /^\/slidev\/[a-z0-9-]+\/1$/, `${entry.id}: invalid landing route`)
    assert.doesNotMatch(canonicalSlideRouteFor(entry), /#/, `${entry.id}: canonical route contains a hash`)
    assert.match(await landingLabelFor(entry), new RegExp(`^${entry.order}\\. `), `${entry.id}: landing label does not use its order`)
    assert.ok(entry.group, `${entry.id}: landing entry lacks group`)
    assert.match(entry.visibility, /^(private|public)$/, `${entry.id}: landing entry lacks valid visibility`)
    assert.match(entry.version, /^\d+\.\d+\.\d+$/, `${entry.id}: landing entry lacks semantic version`)
  }
})

test('landing labels follow deck titles and explicit section order', async () => {
  assert.deepEqual(visiblePreviews().map((entry) => [entry.group, entry.order]), [
    ['Templates', 1],
    ['Decks', 1], ['Decks', 2], ['Decks', 3],
    ['Subdecks', 1], ['Subdecks', 2], ['Subdecks', 3],
  ])
  const labels = await Promise.all(visiblePreviews().map(landingLabelFor))
  assert.equal(labels[0], '1. Modrian - Template')
  assert.equal(labels[3], '3. Bitcoin For Game Development')
})

test('public release inventory is limited to explicitly public landing decks', () => {
  assert.deepEqual(publicPreviews().map((entry) => entry.id), [
    'modrian-template',
    'blockchain-for-game-designers',
    'blockchain-for-game-developers',
    'bitcoin-for-games',
    'tease-subdeck',
    'outro',
    'games-subdeck',
  ])
})

test('the browser editing fixture is isolated from author-facing decks', () => {
  const fixture = livePreviewManifest.find((entry) => entry.id === 'live-preview-fixture')
  assert.ok(fixture, 'missing live preview fixture')
  assert.equal(fixture.testOnly, true)
  assert.equal(fixture.landing, false)
  assert.match(fixture.source, /^fixtures\//)
  assert.equal(visiblePreviews().some((entry) => entry.source === fixture.source), false)
})

test('normalizes bases and rejects duplicate ports, routes, owners, and scripts', () => {
  assert.equal(normalizedBase('/slidev/demo//'), '/slidev/demo/')
  assert.equal(normalizedBase('slidev/demo/'), null)
  const fixture = { ...livePreviewManifest[0] }
  const duplicatePort = { ...livePreviewManifest[1], port: fixture.port }
  const duplicateRoute = { ...livePreviewManifest[1], port: 3999, base: fixture.base }
  const wrongOwner = { ...livePreviewManifest[1], port: 3998, editorOwner: fixture.id }
  const invalid = validateLivePreviewManifest([fixture, duplicatePort, duplicateRoute, wrongOwner], { [fixture.script]: 'x' })
  assert.equal(invalid.valid, false)
  assert.match(invalid.errors.join('\n'), /duplicate or conflicting port 3042/)
  assert.match(invalid.errors.join('\n'), /duplicate base \/slidev\/seriph\//)
  assert.match(invalid.errors.join('\n'), /editor owner must match/)
  assert.match(invalid.errors.join('\n'), /unsupported script/)
  const duplicateOrder = validateLivePreviewManifest([
    { ...livePreviewManifest[8] },
    { ...livePreviewManifest[9], order: livePreviewManifest[8].order },
  ])
  assert.match(duplicateOrder.errors.join('\n'), /duplicate landing order/)
})
