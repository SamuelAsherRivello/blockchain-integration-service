import { mkdirSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-chromium'

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const slidevDirectory = resolve(scriptDirectory, '..')
const templateUrl = process.env.MONDRIAN_TEMPLATE_URL ?? 'http://localhost:3049/slidev/modrian-template'
const blockchainUrl = process.env.BLOCKCHAIN_DECK_URL ?? 'http://localhost:3051/slidev/blockchain-for-game'
const screenshotDirectory = resolve(process.env.SLIDEV_SCREENSHOT_DIR ?? resolve(slidevDirectory, '../../../output/screenshots/mondrian-slidev-refactor'))

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

async function renderedLayout(page, url, expectedLayout) {
  await page.goto(url, { waitUntil: 'domcontentloaded' })
  await page.locator(`.slidev-layout.${expectedLayout}`).last().waitFor()
  await page.waitForTimeout(250)
  const classes = await page.locator('.slidev-layout').evaluateAll((nodes) => nodes.map((node) => node.className))
  if (!classes.some((classes) => classes.includes(expectedLayout)))
    throw new Error(`${url} did not render ${expectedLayout}; rendered: ${classes.join(' | ')}`)
}

const deck = parseSlides(resolve(slidevDirectory, 'blockchain-for-game.md'))
mkdirSync(screenshotDirectory, { recursive: true })
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
page.setDefaultTimeout(10_000)
page.setDefaultNavigationTimeout(10_000)

try {
  for (const slide of deck) {
    const { layout, catalogSlide } = slide.frontmatter
    await renderedLayout(page, `${templateUrl}/${catalogSlide}`, layout)
    await page.screenshot({ path: resolve(screenshotDirectory, `catalog-${catalogSlide}-${layout}.png`) })
    await renderedLayout(page, `${blockchainUrl}/${slide.page}`, layout)
    await page.screenshot({ path: resolve(screenshotDirectory, `blockchain-${slide.page}-${layout}.png`) })
    console.log(`Verified Blockchain slide ${slide.page}: ${layout} matches catalog slide ${catalogSlide}.`)
  }
}
finally {
  await browser.close()
}
