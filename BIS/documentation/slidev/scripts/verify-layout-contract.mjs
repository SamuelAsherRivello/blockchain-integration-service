import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  declaredMondrianInventory,
  expectedTheme,
  frontmatterMatches,
  parseSlides,
  registeredPages,
  slidevDirectory,
} from './mondrian-layout-inventory.mjs'

function slideBody(source, page) {
  const slides = frontmatterMatches(source)
  const current = slides[page - 1]
  if (!current) return ''
  return source.slice(current.index + current[0].length, slides[page]?.index).trim()
}

const requiredGuidanceMarkers = [
  'subsection-title-capacity',
  'image-left-choice',
  'image-right-choice',
  'image-bottom-capacity',
  'blank-intent',
  'right-diagram-capacity',
  'gallery-density',
]

const requiredHierarchyMarkers = [
  'comparison-primary',
  'fact-primary',
  'image-primary',
  'diagram-primary',
]

function galleryLabels(source) {
  const grid = source.match(/<div class="video-thumbnail-grid">([\s\S]*?)<\/div>/)?.[1] ?? ''
  return [...grid.matchAll(/<a\s+[^>]*aria-label="([^"]+)"/g)].map((match) => match[1])
}

function auditCatalog(catalog, manifest, catalogSource, themeStyles) {
  const errors = []
  const catalogExamples = new Map()
  const manifestLayouts = manifest.layouts ?? {}

  if (catalog[0]?.frontmatter.theme !== expectedTheme)
    errors.push(`Template deck theme must be ${expectedTheme}.`)

  for (const slide of catalog) {
    const { layout, catalogLayout } = slide.frontmatter
    if (!catalogLayout) continue
    if (layout !== catalogLayout)
      errors.push(`Catalog slide ${slide.page} declares ${catalogLayout} but renders ${layout}.`)
    if (!manifestLayouts[catalogLayout])
      errors.push(`Catalog slide ${slide.page} uses unknown layout ${catalogLayout}.`)
    const examples = catalogExamples.get(catalogLayout) ?? []
    examples.push(slide.page)
    catalogExamples.set(catalogLayout, examples)
  }

  for (const [layout, definition] of Object.entries(manifestLayouts)) {
    const actualPages = catalogExamples.get(layout) ?? []
    const expectedPages = registeredPages(definition)
    if (!actualPages.length) {
      errors.push(`Theme layout ${layout} has no catalog example.`)
      continue
    }
    if (JSON.stringify(actualPages) !== JSON.stringify(expectedPages))
      errors.push(`Theme layout ${layout} is cataloged on slide(s) ${actualPages.join(', ')}, not declared ${expectedPages.join(', ')}.`)
    if (definition.catalogSlide !== expectedPages[0])
      errors.push(`Theme layout ${layout} primary catalog slide must be ${expectedPages[0]}.`)
  }

  for (const marker of requiredGuidanceMarkers) {
    if (!catalogSource.includes(`data-guidance="${marker}"`))
      errors.push(`Catalog guidance marker ${marker} is missing.`)
  }

  for (const marker of requiredHierarchyMarkers) {
    if (!catalogSource.includes(`data-example-hierarchy="${marker}"`))
      errors.push(`Catalog hierarchy marker ${marker} is missing.`)
  }

  const labels = galleryLabels(catalogSource)
  if (labels.length !== 12)
    errors.push(`Blockchain XP catalog must expose 12 labeled gallery links, found ${labels.length}.`)
  if (new Set(labels).size !== labels.length)
    errors.push('Blockchain XP catalog gallery labels must be unique.')

  if (!themeStyles.includes('@media (prefers-reduced-motion: reduce)')
    || !themeStyles.includes('.mondrian-logos-template__link')
    || !themeStyles.includes('.video-thumbnail-grid a')
    || !themeStyles.includes('animation: none !important;'))
    errors.push('Catalog gallery reduced-motion coverage is missing.')

  return { errors, catalogExamples }
}

function auditDeck(deck, manifest, slides = parseSlides(deck.path)) {
  const errors = []
  const manifestLayouts = manifest.layouts ?? {}
  const label = deck.name

  if (slides[0]?.frontmatter.theme !== expectedTheme)
    errors.push(`${label} deck theme must be ${expectedTheme}.`)

  for (const slide of slides) {
    const { layout, templateLayout, catalogSlide, styleSlide, theme, templateExample } = slide.frontmatter
    if (!layout) continue
    if (theme && theme !== expectedTheme)
      errors.push(`${label} slide ${slide.page} overrides the Mondrian theme with ${theme}.`)
    if (!layout.startsWith('mondrian-'))
      errors.push(`${label} slide ${slide.page} uses non-Mondrian layout ${layout}.`)
    if (!templateLayout || templateLayout !== layout)
      errors.push(`${label} slide ${slide.page} maps ${templateLayout ?? '(missing)'} but renders ${layout}.`)
    const definition = manifestLayouts[layout]
    if (!definition) {
      errors.push(`${label} slide ${slide.page} uses uncataloged layout ${layout}.`)
      continue
    }
    if (!registeredPages(definition).includes(Number(catalogSlide)))
      errors.push(`${label} slide ${slide.page} points to catalog slide ${catalogSlide ?? '(missing)'} instead of a current ${layout} example (${registeredPages(definition).join(', ')}).`)
    if (templateExample && Number(templateExample) !== Number(catalogSlide))
      errors.push(`${label} slide ${slide.page} declares template example ${templateExample} but points to catalog slide ${catalogSlide}.`)
    if (styleSlide)
      errors.push(`${label} slide ${slide.page} still uses numeric-only styleSlide metadata.`)
  }
  return { errors, slides }
}

function auditLifecycle(inventory, scripts) {
  const errors = []
  for (const entry of [inventory.catalog, ...inventory.decks]) {
    for (const scriptName of entry.scripts) {
      const lifecycleName = `pre${scriptName}`
      if (scripts[lifecycleName] !== 'npm run sync:layout-mappings')
        errors.push(`${scriptName} must run ${lifecycleName} as npm run sync:layout-mappings before Slidev consumes its entry.`)
    }
  }
  return errors
}

function auditTableOfContentsStyle(catalogSource, deck, slides) {
  const errors = []
  const catalogBullets = slideBody(catalogSource, 4)
    .split(/\r?\n/)
    .filter((line) => /^\s*[-*+]\s+/.test(line))

  if (catalogBullets.length !== 3)
    errors.push('Catalog slide 4 must contain exactly three table-of-contents bullets.')
  for (const bullet of catalogBullets) {
    if (/(\*\*|__|<strong\b|<b\b|catalog-primary-example)/iu.test(bullet))
      errors.push('Catalog slide 4 table-of-contents bullets must use uniform, unbolded formatting.')
  }

  const deckSource = readFileSync(deck.path, 'utf8')
  for (const slide of slides.filter((entry) => Number(entry.frontmatter.catalogSlide) === 4)) {
    const bullets = slideBody(deckSource, slide.page)
      .split(/\r?\n/)
      .filter((line) => /^\s*[-*+]\s+/.test(line))
    for (const bullet of bullets) {
      if (/(\*\*|__|<strong\b|<b\b|catalog-primary-example)/iu.test(bullet))
        errors.push(`${deck.name} slide ${slide.page} maps to catalog slide 4 but bolds a table-of-contents bullet.`)
    }
  }
  return errors
}

const inventory = declaredMondrianInventory()
const catalogPath = inventory.catalog.path
const catalogSource = inventory.catalog.source
const themeStyles = readFileSync(resolve(slidevDirectory, 'themes/mondrian-final/styles/final.css'), 'utf8')
const catalog = parseSlides(catalogPath)
const manifest = JSON.parse(readFileSync(resolve(slidevDirectory, 'themes/mondrian-final/layout-catalog.json'), 'utf8'))
const packageScripts = JSON.parse(readFileSync(resolve(slidevDirectory, 'package.json'), 'utf8')).scripts ?? {}
const result = auditCatalog(catalog, manifest, catalogSource, themeStyles)
const deckResults = inventory.decks.map((deck) => ({ deck, ...auditDeck(deck, manifest) }))
for (const deckResult of deckResults) result.errors.push(...deckResult.errors)
result.errors.push(...auditLifecycle(inventory, packageScripts))

const blockchain = deckResults.find(({ deck }) => deck.name === 'blockchain-for-game-designers')
if (!blockchain) result.errors.push('Declared Mondrian inventory must include blockchain-for-game-designers.')
else result.errors.push(...auditTableOfContentsStyle(catalogSource, blockchain.deck, blockchain.slides))

if (process.argv.includes('--self-test')) {
  const primaryDeck = deckResults[0]
  const mismatchedLayout = primaryDeck.slides.map((slide) => ({ ...slide, frontmatter: { ...slide.frontmatter } }))
  mismatchedLayout[0].frontmatter.templateLayout = 'mondrian-content'
  if (!auditDeck(primaryDeck.deck, manifest, mismatchedLayout).errors.some((error) => error.includes('maps mondrian-content')))
    throw new Error('Layout-contract self-test did not reject a mismatched layout reference.')

  const staleCatalog = primaryDeck.slides.map((slide) => ({ ...slide, frontmatter: { ...slide.frontmatter } }))
  staleCatalog[0].frontmatter.catalogSlide = '999'
  if (!auditDeck(primaryDeck.deck, manifest, staleCatalog).errors.some((error) => error.includes('points to catalog slide 999')))
    throw new Error('Layout-contract self-test did not reject a stale catalog reference.')

  const themeOverride = primaryDeck.slides.map((slide) => ({ ...slide, frontmatter: { ...slide.frontmatter } }))
  themeOverride[0].frontmatter.theme = 'default'
  if (!auditDeck(primaryDeck.deck, manifest, themeOverride).errors.some((error) => error.includes('overrides the Mondrian theme')))
    throw new Error('Layout-contract self-test did not reject a theme override.')

  const missingGuidance = catalogSource.replace('data-guidance="blank-intent"', 'data-guidance="missing"')
  if (!auditCatalog(catalog, manifest, missingGuidance, themeStyles).errors.some((error) => error.includes('guidance marker blank-intent')))
    throw new Error('Layout-contract self-test did not reject a missing guidance marker.')

  const duplicateLabelSource = catalogSource.replace('aria-label="Moralis tutorial: I7gTbRFBYc0"', 'aria-label="Moralis tutorial: BpimlpUPqDU"')
  if (!auditCatalog(catalog, manifest, duplicateLabelSource, themeStyles).errors.some((error) => error.includes('gallery labels must be unique')))
    throw new Error('Layout-contract self-test did not reject duplicate gallery labels.')

  if (!auditCatalog(catalog, manifest, catalogSource, '').errors.some((error) => error.includes('reduced-motion coverage')))
    throw new Error('Layout-contract self-test did not reject missing reduced-motion coverage.')

  const expectedDecks = ['blockchain-for-game-designers', 'bitcoin-for-games', 'outro']
  for (const name of expectedDecks) {
    if (!inventory.decks.some((deck) => deck.name === name))
      throw new Error(`Layout-contract self-test did not discover ${name}.`)
  }
  if (inventory.decks.some((deck) => deck.name === 'template-deck'))
    throw new Error('Layout-contract self-test incorrectly discovered a legacy template as a Mondrian content deck.')

  const missingLifecycle = { ...packageScripts }
  delete missingLifecycle[`pre${inventory.decks[0].scripts[0]}`]
  if (!auditLifecycle(inventory, missingLifecycle).some((error) => error.includes(`pre${inventory.decks[0].scripts[0]}`)))
    throw new Error('Layout-contract self-test did not reject a missing synchronization lifecycle.')

  console.log('Layout-contract self-tests passed.')
}

if (result.errors.length) {
  console.error('Mondrian layout-contract verification failed:')
  for (const error of result.errors) console.error(`- ${error}`)
  process.exit(1)
}

console.log(`Mondrian layout contract passed: ${catalog.length} catalog slides, ${deckResults.map(({ deck, slides }) => `${slides.length} ${deck.name} slides`).join(', ')}.`)
for (const { deck, slides } of deckResults) {
  for (const slide of slides.filter((entry) => entry.frontmatter.layout))
    console.log(`- ${deck.name} slide ${slide.page}: ${slide.frontmatter.layout} → catalog slide ${slide.frontmatter.catalogSlide}`)
}
