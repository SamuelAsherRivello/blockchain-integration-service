import { chromium } from "playwright-chromium"
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
await page.goto("http://localhost:3051/slidev/blockchain-for-game/36", { waitUntil: "networkidle" })
await page.waitForTimeout(2000)
const report = await page.locator(".slidev-layout:visible").evaluate((layout) => {
  const pageRect = layout.closest(".slidev-page").getBoundingClientRect()
  const mermaid = layout.querySelector(".mermaid")
  const rect = mermaid?.getBoundingClientRect()
  return { layout: layout.className, viewport: {width: pageRect.width, height: pageRect.height}, mermaid: rect && {x: rect.x, y: rect.y, width: rect.width, height: rect.height}, overflow: rect && {left: rect.left < pageRect.left, top: rect.top < pageRect.top, right: rect.right > pageRect.right, bottom: rect.bottom > pageRect.bottom} }
})
await page.screenshot({ path: "output/screenshots/slide-36-qa/slide-36.png", fullPage: false })
console.log(JSON.stringify(report, null, 2))
await browser.close()

