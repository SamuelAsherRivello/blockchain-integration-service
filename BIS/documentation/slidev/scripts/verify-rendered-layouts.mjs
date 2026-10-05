import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-chromium'

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const slidevDirectory = resolve(scriptDirectory, '..')
const templateUrl = process.env.MONDRIAN_TEMPLATE_URL ?? 'http://localhost:3049/slidev/modrian-template'
const blockchainUrl = process.env.BLOCKCHAIN_DECK_URL ?? 'http://localhost:3051/slidev/blockchain-for-game-master-deck'
const screenshotDirectory = resolve(process.env.SLIDEV_SCREENSHOT_DIR ?? resolve(slidevDirectory, '../../../output/screenshots/resync-deck-to-match-template'))
const requestedPages = new Set((process.env.SLIDEV_REVIEW_SLIDES ?? '').split(',').map((value) => value.trim()).filter(Boolean).map(Number).filter(Number.isInteger))
const guidanceExpectations = [
  { slide: 2, marker: 'subsection-title-capacity' },
  { slide: 10, marker: 'image-left-choice' },
  { slide: 11, marker: 'image-right-choice' },
  { slide: 12, marker: 'image-bottom-capacity' },
  { slide: 13, marker: 'blank-intent' },
  { slide: 15, marker: 'right-diagram-capacity' },
  { slide: 17, marker: 'gallery-density' },
  { slide: 18, marker: 'gallery-density' },
  { slide: 19, marker: 'about-close-choice' },
  { slide: 20, marker: 'end-cards-close-choice' },
]

function parseSlides(path) {
  const source = readFileSync(path, 'utf8')
  return [...source.matchAll(/(?:^|\r?\n)---\r?\n([\s\S]*?)\r?\n---(?=\r?\n|$)/g)].map((block, index) => {
    const frontmatter = {}
    for (const line of block[1].split(/\r?\n/)) {
      const match = line.match(/^([A-Za-z][A-Za-z0-9]*):\s*(.*?)\s*$/)
      if (match) frontmatter[match[1]] = match[2]
    }
    return { page: index + 1, frontmatter }
  })
}

async function renderedLayout(page, url, expectedLayout, imageTreatment) {
  await page.goto(url, { waitUntil: 'domcontentloaded' })
  const visibleLayout = page.locator(`.slidev-layout.${expectedLayout}:visible`)
  await visibleLayout.waitFor()
  const hasMermaid = await page.locator('.slidev-layout:visible .mermaid').count() > 0
  if (hasMermaid) {
    await page.waitForFunction(() => [...document.querySelectorAll('.mermaid')].some((element) => {
      const svg = element.shadowRoot?.querySelector('svg')
      return Boolean(svg && svg.getBoundingClientRect().width > 20 && svg.getBoundingClientRect().height > 20)
    }))
  }
  // Mermaid's custom element may publish its SVG before its final layout pass.
  // Wait through that pass so review screenshots never capture a blank canvas.
  await page.waitForTimeout(hasMermaid || imageTreatment === 'generated-original-2x' ? 1500 : 400)
  const classes = await page.locator('.slidev-layout:visible').evaluateAll((nodes) => nodes.map((node) => node.className))
  if (!classes.some((className) => className.includes(expectedLayout)))
    throw new Error(`${url} did not render ${expectedLayout}; rendered: ${classes.join(' | ')}`)

  return page.locator('.slidev-layout:visible').evaluate((layout, { imageTreatment, expectedLayout }) => {
    // Image-left/right layouts own only a content pane; their image pane is a
    // sibling in the full Slidev page. Review against that whole 1280×720
    // presentation canvas so deliberate pane overlap is not misreported.
    const canvasRect = (layout.closest('.slidev-page') ?? layout).getBoundingClientRect()
    const viewport = { width: Math.round(canvasRect.width), height: Math.round(canvasRect.height) }
    const issues = []
    const inspected = []
    for (const node of layout.querySelectorAll('img, h1, h2, p, li, .mermaid')) {
      const rect = node.getBoundingClientRect()
      if (rect.width < 2 || rect.height < 2) continue
      const label = node.tagName === 'IMG' ? `image:${node.getAttribute('alt') || 'unnamed'}` : node.tagName.toLowerCase()
      inspected.push({ label, x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) })
      if (rect.left < canvasRect.left - 1 || rect.top < canvasRect.top - 1 || rect.right > canvasRect.right + 1 || rect.bottom > canvasRect.bottom + 1)
        issues.push(`${label} exceeds the ${viewport.width}x${viewport.height} layout canvas at ${Math.round(rect.x)},${Math.round(rect.y)} (${Math.round(rect.width)}x${Math.round(rect.height)}).`)
    }
    const imagePane = layout.querySelector('.mondrian-image-bottom__pane')
    const imageArt = imagePane?.querySelector('.mondrian-image-bottom__art')
    if (imageTreatment === 'generated-original-2x') {
      if (!imagePane || !imageArt) {
        issues.push('Generated loop visual is missing its image pane or full-pane artwork.')
      } else {
        const paneRect = imagePane.getBoundingClientRect()
        const artRect = imageArt.getBoundingClientRect()
        if (Math.abs(paneRect.width - artRect.width) > 1 || Math.abs(paneRect.height - artRect.height) > 1)
          issues.push('Generated loop artwork does not fill its designated image pane.')
      }
    }
    const geometry = (node) => {
      if (!node) return undefined
      const { x, y, width, height } = node.getBoundingClientRect()
      return { x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height) }
    }
    const imageBottomGeometry = expectedLayout === 'mondrian-image-bottom' ? {
      copy: geometry(layout.querySelector('.mondrian-image-bottom__copy')),
      heading: geometry(layout.querySelector('.mondrian-image-bottom__copy h1')),
      supportingCopy: geometry(layout.querySelector('.mondrian-image-bottom__copy h2, .mondrian-image-bottom__copy p')),
      pane: geometry(layout.querySelector('.mondrian-image-bottom__pane')),
    } : undefined
    return { viewport, inspected, issues, imageBottomGeometry }
  }, { imageTreatment, expectedLayout })
}

function geometryMismatch(reference, candidate, label, catalogSlide, issues) {
  if (!reference || !candidate) return
  for (const key of ['x', 'y']) {
    if (Math.abs(reference[key] - candidate[key]) > 1)
      issues.push(`Image Bottom ${label} ${key}-position ${candidate[key]} does not match catalog slide ${catalogSlide} (${reference[key]}).`)
  }
}

async function reviewCatalogGuidance(page) {
  const review = []
  const issues = []
  for (const { slide, marker } of guidanceExpectations) {
    await page.goto(`${templateUrl}/${slide}`, { waitUntil: 'domcontentloaded' })
    const layout = page.locator('.slidev-layout:visible')
    await layout.waitFor()
    const guidance = layout.locator(`[data-guidance="${marker}"]`)
    await guidance.waitFor()
    const snapshot = await guidance.evaluate((node) => {
      const rect = node.getBoundingClientRect()
      const style = getComputedStyle(node)
      return {
        text: node.textContent?.trim() ?? '',
        visible: style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 2 && rect.height > 2,
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      }
    })
    if (!snapshot.visible || !snapshot.text)
      issues.push(`Catalog slide ${slide} does not visibly render guidance ${marker}.`)
    review.push({ slide, marker, ...snapshot })
  }

  const reducedMotion = []
  await page.emulateMedia({ reducedMotion: 'reduce' })
  try {
    for (const [slide, selector] of [[17, '.video-thumbnail-grid a'], [18, '.mondrian-logos-template__link']]) {
      await page.goto(`${templateUrl}/${slide}`, { waitUntil: 'domcontentloaded' })
      const layout = page.locator('.slidev-layout:visible')
      await layout.waitFor()
      const entries = await layout.locator(selector).evaluateAll((nodes) => nodes.map((node, index) => {
        const rect = node.getBoundingClientRect()
        const style = getComputedStyle(node)
        return {
          index: index + 1,
          visible: style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 2 && rect.height > 2,
          opacity: Number(style.opacity),
          animationName: style.animationName,
        }
      }))
      if (!entries.length)
        issues.push(`Catalog slide ${slide} has no gallery items to review under reduced motion.`)
      for (const entry of entries) {
        if (!entry.visible || entry.opacity < .99 || entry.animationName !== 'none')
          issues.push(`Catalog slide ${slide} gallery item ${entry.index} is not statically visible under reduced motion.`)
      }
      reducedMotion.push({ slide, selector, entries })
    }
  }
  finally {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
  }

  return { guidance: review, reducedMotion, issues }
}

const deck = parseSlides(resolve(slidevDirectory, 'blockchain-for-game-master-deck.md'))
const slidesToReview = requestedPages.size ? deck.filter((slide) => requestedPages.has(slide.page)) : deck
if (requestedPages.size && slidesToReview.length !== requestedPages.size)
  throw new Error(`Requested rendered-review slide pages were not found: ${[...requestedPages].join(', ')}.`)
mkdirSync(screenshotDirectory, { recursive: true })
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
page.setDefaultTimeout(10_000)
page.setDefaultNavigationTimeout(10_000)

try {
  const catalogContract = await reviewCatalogGuidance(page)
  writeFileSync(resolve(screenshotDirectory, 'catalog-guidance-review.json'), `${JSON.stringify(catalogContract, null, 2)}\n`)
  const review = []
  for (const slide of slidesToReview) {
    const { layout, catalogSlide, imageTreatment = '' } = slide.frontmatter
    const catalogReview = await renderedLayout(page, `${templateUrl}/${catalogSlide}`, layout, '')
    await page.screenshot({ path: resolve(screenshotDirectory, `catalog-${catalogSlide}-${layout}.png`) })
    const visualReview = await renderedLayout(page, `${blockchainUrl}/${slide.page}`, layout, imageTreatment)
    if (layout === 'mondrian-image-bottom') {
      geometryMismatch(catalogReview.imageBottomGeometry?.copy, visualReview.imageBottomGeometry?.copy, 'copy anchor', catalogSlide, visualReview.issues)
      geometryMismatch(catalogReview.imageBottomGeometry?.heading, visualReview.imageBottomGeometry?.heading, 'heading', catalogSlide, visualReview.issues)
      // Slides without a subtitle are allowed to give the artwork the extra
      // vertical room. When a subtitle exists, its shared position is exact.
      if (visualReview.imageBottomGeometry?.supportingCopy)
        geometryMismatch(catalogReview.imageBottomGeometry?.supportingCopy, visualReview.imageBottomGeometry.supportingCopy, 'supporting copy', catalogSlide, visualReview.issues)
    }
    await page.screenshot({ path: resolve(screenshotDirectory, `blockchain-${slide.page}-${layout}.png`) })
    review.push({ slide: slide.page, layout, imageTreatment, ...visualReview })
    console.log(`Verified Blockchain slide ${slide.page}: ${layout} matches catalog slide ${catalogSlide}.`)
  }
  writeFileSync(resolve(screenshotDirectory, 'visual-review.json'), `${JSON.stringify(review, null, 2)}\n`)
  const problems = [
    ...catalogContract.issues,
    ...review.flatMap(({ slide, issues }) => issues.map((issue) => `Slide ${slide}: ${issue}`)),
  ]
  if (problems.length) throw new Error(`Rendered visual review found ${problems.length} canvas-bound issue(s):\n${problems.join('\n')}`)
}
finally {
  await browser.close()
}
