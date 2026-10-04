import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const slidevDirectory = resolve(scriptDirectory, '..')
const expectedTheme = './themes/mondrian-final'

function parseSlides(path) {
  const source = readFileSync(path, 'utf8')
  const frontmatterBlocks = [...source.matchAll(/(?:^|\r?\n)---\r?\n([\s\S]*?)\r?\n---(?=\r?\n|$)/g)]
  return frontmatterBlocks.map((block, index) => {
    const frontmatter = {}
    const lines = block[1].split(/\r?\n/)
    for (const line of lines) {
      const match = line.match(/^([A-Za-z][A-Za-z0-9]*):\s*(.*?)\s*$/)
      if (match) frontmatter[match[1]] = match[2]
    }
    return { page: index + 1, frontmatter }
  })
}

function audit(catalog, deck, manifest) {
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
    if (!catalogExamples.has(catalogLayout)) catalogExamples.set(catalogLayout, slide.page)
  }

  for (const [layout, definition] of Object.entries(manifestLayouts)) {
    const catalogPage = catalogExamples.get(layout)
    if (!catalogPage)
      errors.push(`Theme layout ${layout} has no catalog example.`)
    else if (catalogPage !== definition.catalogSlide)
      errors.push(`Theme layout ${layout} is cataloged on slide ${catalogPage}, not declared slide ${definition.catalogSlide}.`)
  }

  if (deck[0]?.frontmatter.theme !== expectedTheme)
    errors.push(`Blockchain deck theme must be ${expectedTheme}.`)

  for (const slide of deck) {
    const { layout, templateLayout, catalogSlide, styleSlide, theme } = slide.frontmatter
    if (theme && theme !== expectedTheme)
      errors.push(`Blockchain slide ${slide.page} overrides the Mondrian theme with ${theme}.`)
    if (!layout?.startsWith('mondrian-'))
      errors.push(`Blockchain slide ${slide.page} uses non-Mondrian layout ${layout ?? '(missing)'}.`)
    if (!templateLayout || templateLayout !== layout)
      errors.push(`Blockchain slide ${slide.page} maps ${templateLayout ?? '(missing)'} but renders ${layout ?? '(missing)'}.`)
    if (!manifestLayouts[layout])
      errors.push(`Blockchain slide ${slide.page} uses uncataloged layout ${layout ?? '(missing)'}.`)
    if (Number(catalogSlide) !== manifestLayouts[layout]?.catalogSlide)
      errors.push(`Blockchain slide ${slide.page} points to catalog slide ${catalogSlide ?? '(missing)'} instead of ${manifestLayouts[layout]?.catalogSlide ?? 'a known example'}.`)
    if (styleSlide)
      errors.push(`Blockchain slide ${slide.page} still uses numeric-only styleSlide metadata.`)
  }

  return { errors, catalogExamples }
}

const catalog = parseSlides(resolve(slidevDirectory, 'template-deck-b.md'))
const deck = parseSlides(resolve(slidevDirectory, 'blockchain-for-game.md'))
const manifest = JSON.parse(readFileSync(resolve(slidevDirectory, 'themes/mondrian-final/layout-catalog.json'), 'utf8'))
const result = audit(catalog, deck, manifest)

if (process.argv.includes('--self-test')) {
  const mismatch = deck.map((slide) => ({ ...slide, frontmatter: { ...slide.frontmatter } }))
  mismatch[0].frontmatter.templateLayout = 'mondrian-content'
  if (!audit(catalog, mismatch, manifest).errors.some((error) => error.includes('maps mondrian-content')))
    throw new Error('Layout-contract self-test did not reject a mismatched audit reference.')
  console.log('Layout-contract mismatch self-test passed.')
}

if (result.errors.length) {
  console.error('Mondrian layout-contract verification failed:')
  for (const error of result.errors) console.error(`- ${error}`)
  process.exit(1)
}

console.log(`Mondrian layout contract passed: ${catalog.length} catalog slides, ${deck.length} Blockchain slides.`)
for (const slide of deck) console.log(`- Blockchain slide ${slide.page}: ${slide.frontmatter.layout} → catalog slide ${slide.frontmatter.catalogSlide}`)
