import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  catalogPages,
  declaredMondrianInventory,
  field,
  frontmatterMatches,
  slidevDirectory,
} from './mondrian-layout-inventory.mjs'

const catalogPath = resolve(slidevDirectory, 'themes/mondrian/layout-catalog.json')

function replaceField(block, name, value) {
  const expression = new RegExp(`^${name}:\\s*.*$`, 'm')
  return expression.test(block) ? block.replace(expression, `${name}: ${value}`) : block.replace(/\r?\n---$/, `\n${name}: ${value}\n---`)
}

function synchronizeDeck(source, deck, pagesByLayout) {
  let mappedSlides = 0
  const synchronized = source.replace(/(?:^|\r?\n)---\r?\n[\s\S]*?\r?\n---(?=\r?\n|$)/g, (block, offset) => {
    const layout = field(block, 'layout')
    if (!layout) return block
    const page = frontmatterMatches(source.slice(0, offset + block.length)).length
    if (!layout.startsWith('mondrian-'))
      throw new Error(`${deck.name} slide ${page} uses unsupported layout ${layout}.`)
    const pages = pagesByLayout.get(layout)
    if (!pages?.length)
      throw new Error(`${deck.name} slide ${page} uses ${layout}, which has no catalog example.`)

    const exampleValue = field(block, 'catalogExample')
    const exampleIndex = exampleValue === undefined ? undefined : Number(exampleValue)
    if (exampleValue !== undefined && (!Number.isInteger(exampleIndex) || exampleIndex < 1 || exampleIndex > pages.length))
      throw new Error(`${deck.name} slide ${page} requests catalog example ${exampleValue} for ${layout}, but only ${pages.length} example(s) exist.`)

    const currentCatalogSlide = Number(field(block, 'catalogSlide'))
    const catalogSlide = exampleIndex ? pages[exampleIndex - 1] : pages.includes(currentCatalogSlide) ? currentCatalogSlide : pages[0]
    mappedSlides += 1
    return replaceField(replaceField(block, 'templateLayout', layout), 'catalogSlide', catalogSlide)
  })
  return { source: synchronized, mappedSlides }
}

export function synchronizationPlan({ catalogSource, catalog, decks }) {
  const pagesByLayout = catalogPages(catalogSource)
  const layouts = catalog.layouts ?? {}
  if (!Object.keys(layouts).length) throw new Error('The Mondrian layout catalog has no registered layouts.')

  for (const layout of pagesByLayout.keys()) {
    if (!layouts[layout]) throw new Error(`Template deck catalogs ${layout}, but it is absent from layout-catalog.json.`)
  }

  const nextCatalog = structuredClone(catalog)
  for (const [layout, definition] of Object.entries(nextCatalog.layouts)) {
    const pages = pagesByLayout.get(layout)
    if (!pages?.length) throw new Error(`Template deck has no catalog example for ${layout}.`)
    definition.catalogSlide = pages[0]
    if (pages.length > 1) definition.catalogSlides = pages
    else delete definition.catalogSlides
  }

  const synchronizedDecks = decks.map((deck) => ({
    ...deck,
    ...synchronizeDeck(deck.source, deck, pagesByLayout),
  }))
  return { pagesByLayout, catalog: `${JSON.stringify(nextCatalog, null, 2)}\n`, decks: synchronizedDecks }
}

function assertSelfTest() {
  const catalogSource = [
    '---\nlayout: mondrian-alpha\ncatalogLayout: mondrian-alpha\n---',
    '---\nlayout: mondrian-beta\ncatalogLayout: mondrian-beta\n---',
  ].join('\n\n')
  const catalog = { layouts: { 'mondrian-alpha': { catalogSlide: 99 }, 'mondrian-beta': { catalogSlide: 99 } } }
  const decks = [
    { name: 'first', source: '---\nlayout: mondrian-alpha\n---', scripts: [] },
    { name: 'second', source: '---\nlayout: mondrian-beta\n---', scripts: [] },
  ]
  const plan = synchronizationPlan({ catalogSource, catalog, decks })
  if (!plan.decks.every((deck) => deck.source.includes('templateLayout: mondrian-')))
    throw new Error('Synchronization self-test did not map every declared deck.')

  const reorderedCatalogSource = [
    '---\nlayout: mondrian-beta\ncatalogLayout: mondrian-beta\n---',
    '---\nlayout: mondrian-alpha\ncatalogLayout: mondrian-alpha\n---',
  ].join('\n\n')
  const reorderedPlan = synchronizationPlan({ catalogSource: reorderedCatalogSource, catalog, decks })
  if (!reorderedPlan.decks[0].source.includes('catalogSlide: 2') || !reorderedPlan.decks[1].source.includes('catalogSlide: 1'))
    throw new Error('Synchronization self-test did not update every deck after a catalog reorder.')

  const invalidDecks = [{ ...decks[0], source: decks[0].source.replace('mondrian-alpha', 'mondrian-missing') }, decks[1]]
  try {
    synchronizationPlan({ catalogSource, catalog, decks: invalidDecks })
    throw new Error('Synchronization self-test accepted an unknown layout.')
  } catch (error) {
    if (!String(error.message).includes('has no catalog example')) throw error
  }
  console.log('Layout-mapping synchronization self-tests passed.')
}

if (process.argv.includes('--self-test')) {
  assertSelfTest()
  process.exit(0)
}

const inventory = declaredMondrianInventory()
const catalogSource = inventory.catalog.source
const catalog = JSON.parse(readFileSync(catalogPath, 'utf8'))
const plan = synchronizationPlan({ catalogSource, catalog, decks: inventory.decks })

const writes = []
if (readFileSync(catalogPath, 'utf8') !== plan.catalog) writes.push({ path: catalogPath, source: plan.catalog })
for (const deck of plan.decks) {
  const original = inventory.decks.find((entry) => entry.path === deck.path).source
  if (original !== deck.source) writes.push({ path: deck.path, source: deck.source })
}

for (const write of writes) writeFileSync(write.path, write.source)
console.log(`Synchronized ${writes.length ? '' : 'already-current '}${plan.decks.length} declared deck(s) from ${plan.pagesByLayout.size} template layouts: ${plan.decks.map((deck) => `${deck.name} (${deck.mappedSlides})`).join(', ')}.`)
