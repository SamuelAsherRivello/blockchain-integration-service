import { existsSync, readFileSync } from 'node:fs'
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
    const contentStart = (block.index ?? 0) + block[0].length
    const contentEnd = frontmatterBlocks[index + 1]?.index ?? source.length
    return { page: index + 1, frontmatter, content: source.slice(contentStart, contentEnd) }
  })
}

function pngDimensions(path) {
  const header = readFileSync(path)
  if (header.length < 24 || header.toString('ascii', 1, 4) !== 'PNG') return null
  return { width: header.readUInt32BE(16), height: header.readUInt32BE(20) }
}

function audit(catalog, deck, manifest, sourceManifest) {
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

  const expectedSourceSlides = sourceManifest.slides ?? []
  if (expectedSourceSlides.length !== sourceManifest.sourceCount)
    errors.push(`Source manifest declares ${sourceManifest.sourceCount} slides but contains ${expectedSourceSlides.length}.`)
  if (deck.length !== expectedSourceSlides.length)
    errors.push(`Blockchain deck has ${deck.length} slides; source manifest has ${expectedSourceSlides.length}.`)

  const seenNumbers = new Set()
  const seenIds = new Set()
  for (const slide of deck) {
    const number = Number(slide.frontmatter.contentSlide)
    const id = slide.frontmatter.contentSlideId
    if (!Number.isInteger(number)) errors.push(`Blockchain slide ${slide.page} has no integer contentSlide.`)
    if (!id) errors.push(`Blockchain slide ${slide.page} has no contentSlideId.`)
    if (seenNumbers.has(number)) errors.push(`Blockchain source number ${number} is duplicated.`)
    if (seenIds.has(id)) errors.push(`Blockchain source object ID ${id} is duplicated.`)
    seenNumbers.add(number)
    seenIds.add(id)
  }

  for (const expected of expectedSourceSlides) {
    const slide = deck.find((item) => Number(item.frontmatter.contentSlide) === expected.number)
    if (!slide) {
      errors.push(`Source slide ${expected.number} is missing from the Blockchain deck.`)
      continue
    }
    if (slide.frontmatter.contentSlideId !== expected.objectId)
      errors.push(`Source slide ${expected.number} uses ${slide.frontmatter.contentSlideId}, expected ${expected.objectId}.`)
    if (slide.frontmatter.imageTreatment !== expected.imageTreatment)
      errors.push(`Source slide ${expected.number} image treatment is ${slide.frontmatter.imageTreatment ?? '(missing)'}, expected ${expected.imageTreatment}.`)
    if (expected.feedbackAssets) {
      const references = `${slide.content}\n${slide.frontmatter.image ?? ''}`
      for (const assetPath of expected.feedbackAssets) {
        if (!references.includes(assetPath))
          errors.push(`Source slide ${expected.number} must reference feedback asset ${assetPath}.`)
        const diskPath = resolve(slidevDirectory, assetPath)
        const dimensions = existsSync(diskPath) ? pngDimensions(diskPath) : null
        if (!dimensions || dimensions.width < 1200 || dimensions.height < 600)
          errors.push(`Source slide ${expected.number} feedback asset ${assetPath} is not a display-ready 2× PNG.`)
      }
      if (expected.number === 5 && expected.feedbackAssets.length !== 2)
        errors.push('Source slide 5 must declare both requested feedback visuals.')
    }
    if (expected.table && !slide.content.includes('<table'))
      errors.push(`Source slide ${expected.number} requires an editable HTML table.`)
    if (expected.imageTreatment === 'editable-text-table' && /<img\b/i.test(slide.content))
      errors.push(`Source slide ${expected.number} must keep table cells as text, not images.`)
    if (expected.assetResolution === 'copied-body-cells-4x') {
      const sourceReferencePath = expected.sourceReferenceAsset && resolve(slidevDirectory, expected.sourceReferenceAsset)
      if (!sourceReferencePath || !existsSync(sourceReferencePath)) {
        errors.push(`Source slide ${expected.number} is missing its declared 2× source reference asset.`)
      } else {
        const sourceDimensions = pngDimensions(sourceReferencePath)
        if (expected.sourceReferenceResolution !== '2x-slide-thumbnail-1600x900' || !sourceDimensions || sourceDimensions.width !== 1600 || sourceDimensions.height !== 900)
          errors.push(`Source slide ${expected.number} source reference asset is not the declared 2× 1600×900 PNG.`)
      }
      const imagePaths = [...slide.content.matchAll(/<img[^>]+src="\.\/([^"?]+)"/g)].map((match) => match[1])
      if (!slide.content.includes('deck-table--source'))
        errors.push(`Source slide ${expected.number} must identify the copied visual-cell table.`)
      if (imagePaths.length !== expected.copiedBodyCellCount)
        errors.push(`Source slide ${expected.number} must reference ${expected.copiedBodyCellCount} copied body-cell images; found ${imagePaths.length}.`)
      const uniquePaths = new Set(imagePaths)
      if (uniquePaths.size !== imagePaths.length)
        errors.push(`Source slide ${expected.number} reuses a copied body-cell image.`)
      for (const imagePath of imagePaths) {
        if (!imagePath.endsWith('-4x.png'))
          errors.push(`Source slide ${expected.number} references a body-cell asset without a 4× filename: ${imagePath}.`)
        const diskPath = resolve(slidevDirectory, imagePath)
        if (!existsSync(diskPath)) {
          errors.push(`Source slide ${expected.number} references missing body-cell asset ${imagePath}.`)
          continue
        }
        const dimensions = pngDimensions(diskPath)
        if (!dimensions || dimensions.width < 1128 || dimensions.height < 624)
          errors.push(`Source slide ${expected.number} body-cell asset ${imagePath} is not a 4× PNG.`)
      }
    }
    if (expected.imageTreatment === 'omit' && /<img\b/i.test(slide.content))
      errors.push(`Source slide ${expected.number} omits imagery but contains an image.`)
    if (expected.imageTreatment.includes('mermaid') && !slide.content.includes('```mermaid'))
      errors.push(`Source slide ${expected.number} requires a Mermaid diagram.`)
  }

  const slide31 = deck.find((slide) => Number(slide.frontmatter.contentSlide) === 31)?.content ?? ''
  const slide32 = deck.find((slide) => Number(slide.frontmatter.contentSlide) === 32)?.content ?? ''
  const slide33 = deck.find((slide) => Number(slide.frontmatter.contentSlide) === 33)?.content ?? ''
  if (slide31.includes('#d4af37') || slide31.includes('#c94141')) errors.push('Slide 31 network must use white lines only.')
  if (!slide32.includes('#d4af37')) errors.push('Slide 32 network must contain gold connection lines.')
  if (!slide33.includes('#d4af37') || !slide33.includes('#c94141')) errors.push('Slide 33 network must contain gold and red blocked connection lines.')

  for (const sourceNumber of [10, 11, 12]) {
    const slide = deck.find((item) => Number(item.frontmatter.contentSlide) === sourceNumber)
    if (slide?.frontmatter.class !== 'feedback-diagram-position')
      errors.push(`Slide ${sourceNumber} must use the 130% feedback diagram stage.`)
  }

  return { errors, catalogExamples }
}

const catalog = parseSlides(resolve(slidevDirectory, 'template-deck-b.md'))
const deck = parseSlides(resolve(slidevDirectory, 'blockchain-for-game.md'))
const manifest = JSON.parse(readFileSync(resolve(slidevDirectory, 'themes/mondrian-final/layout-catalog.json'), 'utf8'))
const sourceManifest = JSON.parse(readFileSync(resolve(slidevDirectory, 'content-source-manifest.json'), 'utf8'))
const result = audit(catalog, deck, manifest, sourceManifest)

if (process.argv.includes('--self-test')) {
  const mismatch = deck.map((slide) => ({ ...slide, frontmatter: { ...slide.frontmatter } }))
  mismatch[0].frontmatter.templateLayout = 'mondrian-content'
  if (!audit(catalog, mismatch, manifest, sourceManifest).errors.some((error) => error.includes('maps mondrian-content')))
    throw new Error('Layout-contract self-test did not reject a mismatched audit reference.')

  const missing = deck.slice(1)
  if (!audit(catalog, missing, manifest, sourceManifest).errors.some((error) => error.includes('Source slide 1 is missing')))
    throw new Error('Source-contract self-test did not reject a missing source mapping.')

  const duplicate = deck.map((slide) => ({ ...slide, frontmatter: { ...slide.frontmatter } }))
  duplicate[1].frontmatter.contentSlide = duplicate[0].frontmatter.contentSlide
  duplicate[1].frontmatter.contentSlideId = duplicate[0].frontmatter.contentSlideId
  if (!audit(catalog, duplicate, manifest, sourceManifest).errors.some((error) => error.includes('is duplicated')))
    throw new Error('Source-contract self-test did not reject a duplicate source mapping.')

  const reordered = deck.map((slide) => ({ ...slide, frontmatter: { ...slide.frontmatter } }))
  ;[reordered[0].frontmatter.contentSlide, reordered[1].frontmatter.contentSlide] = [reordered[1].frontmatter.contentSlide, reordered[0].frontmatter.contentSlide]
  if (!audit(catalog, reordered, manifest, sourceManifest).errors.some((error) => error.includes('uses') && error.includes('expected')))
    throw new Error('Source-contract self-test did not reject a reordered source mapping.')

  const missingFeedbackVisual = deck.map((slide) => ({ ...slide, frontmatter: { ...slide.frontmatter } }))
  const feedbackSlide = missingFeedbackVisual.find((slide) => Number(slide.frontmatter.contentSlide) === 3)
  const feedbackAsset = sourceManifest.slides.find((slide) => slide.number === 3)?.feedbackAssets?.[0]
  feedbackSlide.frontmatter.image = feedbackSlide.frontmatter.image?.replace(feedbackAsset, 'missing-source.png')
  if (!audit(catalog, missingFeedbackVisual, manifest, sourceManifest).errors.some((error) => error.includes('feedback asset')))
    throw new Error('Layout-contract self-test did not reject a missing feedback visual.')

  console.log('Layout and source-contract self-tests passed.')
}

if (result.errors.length) {
  console.error('Mondrian layout-contract verification failed:')
  for (const error of result.errors) console.error(`- ${error}`)
  process.exit(1)
}

console.log(`Mondrian layout and source contract passed: ${catalog.length} catalog slides, ${deck.length} Blockchain slides.`)
for (const slide of deck) console.log(`- Blockchain slide ${slide.page}: ${slide.frontmatter.layout} → catalog slide ${slide.frontmatter.catalogSlide}`)
