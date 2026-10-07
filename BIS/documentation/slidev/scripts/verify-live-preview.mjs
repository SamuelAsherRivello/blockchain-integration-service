import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { chromium } from 'playwright-chromium'
import { landingService, livePreviewManifest, routeFor } from './live-preview-manifest.mjs'
import { fingerprintEditorRecord, scanWithStableSource } from './live-preview-coherence.mjs'
import { classifyCoherenceFailure } from './live-preview-diagnostics.mjs'

const profile = process.argv.includes('--profile') ? process.argv[process.argv.indexOf('--profile') + 1] : 'integration'
const root = fileURLToPath(new URL('../../../../', import.meta.url))
const reportRoot = path.join(root, 'output', 'reports', 'slidev-live-preview')
const reportId = new Date().toISOString().replace(/[:.]/g, '-')
const slidevRoot = fileURLToPath(new URL('..', import.meta.url))
const statusUrl = `http://localhost:${landingService.port}/__slidev/preview-status.json`
const failures = []
const summary = { profile, startedAt: new Date().toISOString(), inventory: [], failures }
const hash = (value) => createHash('sha256').update(String(value).replace(/\r\n/g, '\n').trim()).digest('hex').slice(0, 16)
const cleanText = (value) => String(value ?? '').replace(/<[^>]*>/g, ' ').replace(/[#*_`>|]/g, ' ').replace(/\s+/g, ' ').trim()
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function request(url, options) {
  const response = await fetch(url, { ...options, cache: 'no-store', signal: AbortSignal.timeout(12_000) })
  const text = await response.text()
  if (!response.ok) throw new Error(`${response.status} ${url}: ${text.slice(0, 200)}`)
  return { response, text, json: () => JSON.parse(text) }
}

async function pageSlideRecords(page) {
  return page.evaluate(async () => {
    const base = location.pathname.replace(/\/[^/]+$/, '/')
    const module = await import(`${base}@slidev/slides`)
    const value = module.slides?.value ?? module.slides ?? []
    return value.map((slide, index) => ({ no: slide.no ?? index + 1, revision: slide.meta?.revision ?? slide.meta?.id ?? null }))
  })
}

async function generatedSlideSource(page, slide) {
  return page.evaluate(async (number) => {
    const base = location.pathname.replace(/\/[^/]+$/, '/')
    const response = await fetch(`${base}@slidev/slides/${number}/md`, { cache: 'no-store' })
    const wrapper = await response.text()
    // Slidev's stable public virtual module re-exports the generated markdown
    // component. Follow that import rather than depending on its hashed file
    // name, which is what detects a stale component for a current API record.
    const generatedPath = /export \* from "([^"]+)"/.exec(wrapper)?.[1]
    if (!generatedPath) return { status: response.status, source: wrapper }
    const generated = await fetch(generatedPath, { cache: 'no-store' })
    return { status: generated.ok ? response.status : generated.status, source: await generated.text() }
  }, slide)
}

async function editorRecord(page, slide) {
  return page.evaluate(async (number) => {
    const response = await fetch(`/__slidev/slides/${number}.json`, { cache: 'no-store' })
    return { status: response.status, cacheControl: response.headers.get('cache-control'), body: await response.json() }
  }, slide)
}

async function inspectDeck(browser, entry, fullScan) {
  const page = await browser.newPage()
  await page.addInitScript(() => {
    const Original = window.WebSocket
    window.__slidevHmrSockets = { opened: 0, open: 0, closed: 0 }
    // eslint-disable-next-line no-global-assign
    window.WebSocket = class SlidevObservedWebSocket extends Original {
      constructor(...args) {
        super(...args)
        window.__slidevHmrSockets.opened += 1
        this.addEventListener('open', () => { window.__slidevHmrSockets.open += 1 })
        this.addEventListener('close', () => { window.__slidevHmrSockets.closed += 1 })
      }
    }
  })
  const route = `http://localhost:${landingService.port}${routeFor(entry)}`
  const result = { id: entry.id, route: routeFor(entry), slides: 0, hmr: null, fingerprints: [], state: 'failed' }
  let currentSlide = 1
  try {
    await page.goto(route, { waitUntil: 'networkidle', timeout: 30_000 })
    const first = await page.locator('#page-root, .slidev-page').first().count()
    const errorOverlay = await page.locator('text=/Internal Server Error|Failed to resolve|SyntaxError/i').count()
    const sockets = await page.evaluate(() => window.__slidevHmrSockets)
    result.hmr = sockets
    if (!first || errorOverlay || !sockets.open) throw new Error(`render/HMR readiness failed: canvas=${first}, errors=${errorOverlay}, sockets=${JSON.stringify(sockets)}`)
    const enumeration = await scanWithStableSource({
      readSource: () => readFile(path.join(slidevRoot, entry.source), 'utf8'),
      scan: async () => ({ records: await pageSlideRecords(page) }),
    })
    const generated = enumeration.records
    result.sourceFingerprint = enumeration.sourceFingerprint
    result.enumerationAttempts = enumeration.attempts
    const scan = fullScan ? generated : generated.slice(0, 1)
    result.slides = generated.length
    for (const generatedRecord of scan) {
      const number = generatedRecord.no
      currentSlide = number
      // Slidev's router can leave a former slide shell mounted when one
      // Playwright page is hard-navigated across a long deck. A fresh page
      // makes every route an independent render assertion.
      const slidePage = number === 1 ? page : await browser.newPage()
      try {
        if (number !== 1) await slidePage.goto(`http://localhost:${landingService.port}${routeFor(entry, number)}`, { waitUntil: 'networkidle', timeout: 30_000 })
      const api = await editorRecord(slidePage, number)
      result.fingerprints.push({ slide: number, editor: fingerprintEditorRecord(api.body), revision: generatedRecord.revision ?? null })
      const apiContent = api.body.content ?? api.body.slide?.content ?? ''
        const generated = await generatedSlideSource(slidePage, number)
      if (api.status !== 200 || !/no-store/i.test(api.cacheControl ?? '')) throw new Error(`transport mismatch ${entry.id}/${number}: editor status/cache ${api.status}/${api.cacheControl}`)
      if (generated.status !== 200) throw new Error(`generated-module transport mismatch ${entry.id}/${number}: ${generated.status}`)
      const contentToken = cleanText(apiContent).match(/[A-Za-z]{5,}/g)?.[0]
      if (contentToken) {
        if (!generated.source.toLowerCase().includes(contentToken.toLowerCase())) throw new Error(`generated-module mismatch ${entry.id}/${number}: editor token ${contentToken} is absent`)
          const visible = await slidePage.locator('#page-root, .slidev-page').first().innerText({ timeout: 10_000 })
        if (!visible.toLowerCase().includes(contentToken.toLowerCase())) throw new Error(`render mismatch ${entry.id}/${number}: expected visible token ${contentToken}`)
      }
      }
      finally { if (number !== 1) await slidePage.close() }
    }
    result.state = 'ready'
  }
  catch (error) {
    result.error = `slide ${currentSlide}: ${error instanceof Error ? error.message : String(error)}`
    failures.push(classifyCoherenceFailure({
      id: entry.id,
      route: result.route,
      slide: currentSlide,
      revision: result.fingerprints.find((fingerprint) => fingerprint.slide === currentSlide)?.revision,
      hmr: result.hmr,
      message: result.error,
    }))
    await page.screenshot({ path: path.join(reportRoot, `${reportId}-${entry.id}-failure.png`), fullPage: true }).catch(() => undefined)
  }
  finally { await page.close() }
  return result
}

async function editorRoundTrip(browser) {
  const entry = livePreviewManifest.find((item) => item.id === 'live-preview-fixture')
  const page = await browser.newPage()
  const sourcePath = path.join(fileURLToPath(new URL('..', import.meta.url)), entry.source)
  const sourceBefore = await readFile(sourcePath, 'utf8')
  const token = `live-preview-token-${Date.now()}`
  const result = { id: entry.id, beforeHash: hash(sourceBefore), restored: false, latencyMs: null }
  try {
    await page.goto(`http://localhost:${landingService.port}${routeFor(entry)}`, { waitUntil: 'networkidle', timeout: 30_000 })
    const before = await editorRecord(page, 1)
    const body = before.body
    const previousContent = body.content ?? body.slide?.content
    if (typeof previousContent !== 'string') throw new Error('fixture editor record has no writable content')
    const updated = { ...body, content: `${previousContent}\n\n${token}` }
    const start = Date.now()
    const save = await page.evaluate(async (payload) => {
      const response = await fetch('/__slidev/slides/1.json', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })
      return { status: response.status, body: await response.text() }
    }, updated)
    if (save.status < 200 || save.status >= 300) throw new Error(`fixture save failed: ${save.status} ${save.body.slice(0, 200)}`)
    let observed = false
    while (Date.now() - start <= 5_000) {
      await page.reload({ waitUntil: 'networkidle', timeout: 15_000 })
      const generated = await generatedSlideSource(page, 1)
      const visible = await page.locator('#page-root, .slidev-page').first().innerText()
      if (generated.source.includes(token) && visible.includes(token)) { observed = true; break }
      await wait(150)
    }
    result.latencyMs = Date.now() - start
    if (!observed) throw new Error(`fixture propagation exceeded 5s (editor revision ${before.body.revision ?? 'unknown'})`)
  }
  catch (error) {
    result.error = error instanceof Error ? error.message : String(error)
    failures.push({ kind: 'editor-round-trip', id: entry.id, message: result.error })
  }
  finally {
    // The fixture is the only file this verifier writes. Restore from the
    // captured on-disk source even if Slidev's editor protocol changes.
    await writeFile(sourcePath, sourceBefore)
    await wait(250)
    result.restored = hash(await readFile(sourcePath, 'utf8')) === result.beforeHash
    if (!result.restored) failures.push({ kind: 'fixture-restore', id: entry.id, message: 'fixture source hash was not restored' })
    await page.close()
  }
  return result
}

await mkdir(reportRoot, { recursive: true })
try {
  const status = await request(statusUrl)
  summary.status = JSON.parse(status.text)
}
catch (error) { failures.push({ kind: 'status', message: error instanceof Error ? error.message : String(error) }) }

const fullScan = profile !== 'fast'
// A Slidev dev server owns an HMR socket per page. Isolate each deck in a
// fresh browser process so a long coherence scan cannot accumulate old Vite
// sockets and make a healthy later deck look blank.
for (const entry of livePreviewManifest) {
  const browser = await chromium.launch({ headless: true })
  try { summary.inventory.push(await inspectDeck(browser, entry, fullScan)) }
  finally { await browser.close() }
}
if (profile !== 'fast') {
  const browser = await chromium.launch({ headless: true })
  try { summary.fixture = await editorRoundTrip(browser) }
  finally { await browser.close() }
}
summary.finishedAt = new Date().toISOString()
summary.ok = failures.length === 0
const reportPath = path.join(reportRoot, `${reportId}-${profile}.json`)
await writeFile(reportPath, `${JSON.stringify(summary, null, 2)}\n`)
process.stdout.write(`${JSON.stringify({ ok: summary.ok, report: path.relative(root, reportPath).replaceAll('\\', '/') })}\n`)
if (!summary.ok) process.exitCode = 1
