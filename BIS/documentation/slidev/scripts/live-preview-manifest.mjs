/**
 * The only inventory of local Slidev preview processes.  Consumers must use
 * this module instead of copying ports, bases, or editor ownership elsewhere.
 */
export const livePreviewManifest = Object.freeze([
  { id: 'seriph', script: 'dev:seriph', source: 'slides.md', port: 3042, base: '/slidev/seriph/', landing: false, editorOwner: 'seriph' },
  { id: 'apple-basic', script: 'dev:apple-basic', source: 'slides.md', port: 3043, base: '/slidev/apple-basic/', landing: false, editorOwner: 'apple-basic' },
  { id: 'dracula', script: 'dev:dracula', source: 'slides.md', port: 3044, base: '/slidev/dracula/', landing: false, editorOwner: 'dracula' },
  { id: 'template', script: 'dev:template', source: 'template-deck.md', port: 3045, base: '/slidev/template/', landing: false, editorOwner: 'template' },
  { id: 'modrian-template-1', script: 'dev:modrian-template-1', source: 'template-deck.md', port: 3046, base: '/slidev/modrian-template-1/', landing: false, editorOwner: 'modrian-template-1' },
  { id: 'modrian-template-2', script: 'dev:modrian-template-2', source: 'modrian-template-2.md', port: 3047, base: '/slidev/modrian-template-2/', landing: false, editorOwner: 'modrian-template-2' },
  { id: 'modrian-template-3', script: 'dev:modrian-template-3', source: 'template-deck.md', port: 3048, base: '/slidev/modrian-template-3/', landing: false, editorOwner: 'modrian-template-3' },
  { id: 'modrian-template', script: 'dev:modrian-template', source: 'modrian-template.md', port: 3049, base: '/slidev/modrian-template/', landing: true, editorOwner: 'modrian-template', label: 'Modrian Template', group: 'Templates' },
  { id: 'blockchain-for-game-master-deck', script: 'dev:blockchain-for-game-master-deck', source: 'blockchain-for-game-master-deck.md', port: 3051, base: '/slidev/blockchain-for-game-master-deck/', landing: true, editorOwner: 'blockchain-for-game-master-deck', label: 'Blockchain For Gaming — Master Deck', group: 'Decks' },
  { id: 'outro', script: 'dev:outro', source: 'outro.md', port: 3052, base: '/slidev/outro/', landing: true, editorOwner: 'outro', label: 'Outro - Subdeck', group: 'Subdecks' },
  { id: 'tease-subdeck', script: 'dev:tease-subdeck', source: 'tease-subdeck.md', port: 3053, base: '/slidev/tease-subdeck/', landing: true, editorOwner: 'tease-subdeck', label: 'Tease Subdeck', group: 'Subdecks' },
  { id: 'live-preview-fixture', script: 'dev:live-preview-fixture', source: 'fixtures/live-preview-fixture.md', port: 3054, base: '/slidev/live-preview-fixture/', landing: false, editorOwner: 'live-preview-fixture', testOnly: true },
])

export const landingService = Object.freeze({ id: 'landing', script: 'dev', port: 3032, base: '/', source: null })

export const normalizedBase = (base) => {
  if (typeof base !== 'string' || !base.startsWith('/') || !base.endsWith('/')) return null
  return base.replace(/\/{2,}/g, '/')
}

export function validateLivePreviewManifest(manifest = livePreviewManifest, packageScripts = {}) {
  const errors = []
  const ids = new Set()
  const ports = new Set([landingService.port])
  const bases = new Set()
  for (const entry of manifest) {
    for (const field of ['id', 'script', 'source', 'port', 'base', 'editorOwner']) {
      if (entry[field] === undefined || entry[field] === null || entry[field] === '') errors.push(`${entry.id ?? '<unknown>'}: missing ${field}`)
    }
    if (!/^[a-z0-9-]+$/.test(entry.id ?? '')) errors.push(`${entry.id ?? '<unknown>'}: invalid id`)
    if (ids.has(entry.id)) errors.push(`${entry.id}: duplicate id`)
    ids.add(entry.id)
    if (ports.has(entry.port)) errors.push(`${entry.id}: duplicate or conflicting port ${entry.port}`)
    ports.add(entry.port)
    const base = normalizedBase(entry.base)
    if (!base) errors.push(`${entry.id}: invalid base ${entry.base}`)
    else if (bases.has(base)) errors.push(`${entry.id}: duplicate base ${base}`)
    else bases.add(base)
    if (entry.editorOwner !== entry.id) errors.push(`${entry.id}: editor owner must match its declared deck`)
    if (Object.keys(packageScripts).length && !packageScripts[entry.script]) errors.push(`${entry.id}: unsupported script ${entry.script}`)
    if (entry.landing && (!entry.label || !entry.group)) errors.push(`${entry.id}: landing entry requires label and group`)
  }
  return { valid: errors.length === 0, errors }
}

export const routeFor = (entry, slide = 1) => `${entry.base}${slide}`
export const editorOwnerForPath = (pathname) => livePreviewManifest.find((entry) => pathname === entry.base.slice(0, -1) || pathname.startsWith(entry.base)) ?? null
export const visiblePreviews = () => livePreviewManifest.filter((entry) => entry.landing)
