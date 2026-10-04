import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-chromium'

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const slidevDirectory = resolve(scriptDirectory, '..')
const templateUrl = process.env.MONDRIAN_TEMPLATE_URL ?? 'http://localhost:3049/slidev/modrian-template'
const blockchainUrl = process.env.BLOCKCHAIN_DECK_URL ?? 'http://localhost:3051/slidev/blockchain-for-game'
const screenshotDirectory = resolve(process.env.SLIDEV_SCREENSHOT_DIR ?? resolve(slidevDirectory, '../../../output/screenshots/update-slide-deck-results-2'))

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
  await page.waitForTimeout(hasMermaid ? 1500 : 400)
  const classes = await page.locator('.slidev-layout:visible').evaluateAll((nodes) => nodes.map((node) => node.className))
  if (!classes.some((className) => className.includes(expectedLayout)))
    throw new Error(`${url} did not render ${expectedLayout}; rendered: ${classes.join(' | ')}`)

  return page.locator('.slidev-layout:visible').evaluate((layout) => {
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
    return { viewport, inspected, issues }
  })
}

const deck = parseSlides(resolve(slidevDirectory, 'blockchain-for-game.md'))
mkdirSync(screenshotDirectory, { recursive: true })
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
page.setDefaultTimeout(10_000)
page.setDefaultNavigationTimeout(10_000)

try {
  const review = []
  for (const slide of deck) {
    const { layout, catalogSlide, imageTreatment = '' } = slide.frontmatter
    await renderedLayout(page, `${templateUrl}/${catalogSlide}`, layout, '')
    await page.screenshot({ path: resolve(screenshotDirectory, `catalog-${catalogSlide}-${layout}.png`) })
    const visualReview = await renderedLayout(page, `${blockchainUrl}/${slide.page}`, layout, imageTreatment)
    await page.screenshot({ path: resolve(screenshotDirectory, `blockchain-${slide.page}-${layout}.png`) })
    review.push({ slide: slide.page, layout, imageTreatment, ...visualReview })
    console.log(`Verified Blockchain slide ${slide.page}: ${layout} matches catalog slide ${catalogSlide}.`)
  }
  writeFileSync(resolve(screenshotDirectory, 'visual-review.json'), `${JSON.stringify(review, null, 2)}\n`)
  const problems = review.flatMap(({ slide, issues }) => issues.map((issue) => `Slide ${slide}: ${issue}`))
  if (problems.length) throw new Error(`Rendered visual review found ${problems.length} canvas-bound issue(s):\n${problems.join('\n')}`)
}
finally {
  await browser.close()
}
