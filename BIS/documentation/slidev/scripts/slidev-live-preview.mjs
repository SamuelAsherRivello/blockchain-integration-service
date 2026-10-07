import { appendFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { watch } from 'node:fs'
import { createHash, randomUUID } from 'node:crypto'
import { spawn, execFile as execFileCallback } from 'node:child_process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { canonicalSlideRouteFor, deckBaseFor, landingService, livePreviewManifest, validateLivePreviewManifest } from './live-preview-manifest.mjs'
import { createServiceState, ownedProcessTarget, recoveryDecision } from './live-preview-policy.mjs'
import { evaluateReadiness, probeHmr } from './live-preview-readiness.mjs'

const execFile = promisify(execFileCallback)
const root = fileURLToPath(new URL('..', import.meta.url))
const repositoryRoot = fileURLToPath(new URL('../../../../', import.meta.url))
const outputRoot = path.join(repositoryRoot, 'output', 'logs', 'slidev-landing')
const statusPath = path.join(outputRoot, 'current-status.json')
const supervisorLockPath = path.join(outputRoot, 'supervisor.lock.json')
const argv = process.argv.slice(2)
const command = argv.find((value) => !value.startsWith('--')) ?? 'start'
const valueFor = (flag, fallback) => {
  const index = argv.indexOf(flag)
  return index === -1 ? fallback : Number(argv[index + 1])
}
const durationHours = valueFor('--duration-hours', 12)
const intervalSeconds = Math.max(5, valueFor('--health-check-seconds', 10))
const sessionId = `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`
const sessionRoot = path.join(outputRoot, sessionId)
const deadline = new Date(Date.now() + durationHours * 60 * 60 * 1000)
const services = [landingService, ...livePreviewManifest]
const state = new Map(services.map((service) => [service.id, createServiceState(service, service.id === 'landing' ? '/' : canonicalSlideRouteFor(service))]))
const children = new Map()
const sourceWatchers = []
const sourceRestartTimers = new Map()
const sourceFingerprints = new Map()
let stopping = false
let holdsSupervisorLock = false

function safeError(error) { return error instanceof Error ? error.message : String(error) }

async function sourceFingerprint(service) {
  if (!service.source) return null
  const source = await readFile(path.join(root, service.source))
  return createHash('sha256').update(source).digest('hex')
}

function processIsAlive(processId) {
  if (!Number.isInteger(processId) || processId <= 0) return false
  try {
    process.kill(processId, 0)
    return true
  }
  catch (error) {
    // Windows can deny a signal probe for an otherwise live process.
    return error?.code === 'EPERM'
  }
}

async function acquireSupervisorLock() {
  await mkdir(outputRoot, { recursive: true })
  const lock = { processId: process.pid, sessionId, acquiredAt: new Date().toISOString() }
  try {
    await writeFile(supervisorLockPath, `${JSON.stringify(lock, null, 2)}\n`, { flag: 'wx' })
    holdsSupervisorLock = true
    return
  }
  catch (error) {
    if (error?.code !== 'EEXIST') throw error
  }

  let existing = null
  try { existing = JSON.parse(await readFile(supervisorLockPath, 'utf8')) }
  catch { /* A concurrently finishing supervisor may have removed the lock. */ }
  if (existing && processIsAlive(existing.processId)) {
    throw new Error(`A Slidev stable-preview supervisor is already running (PID ${existing.processId}, session ${existing.sessionId ?? 'unknown'}).`)
  }

  // A forced task termination cannot run the normal cleanup handler. Reclaim
  // only a lock whose recorded owner is no longer alive, then acquire it
  // exclusively so a healthy supervisor can never be replaced by a duplicate.
  await rm(supervisorLockPath, { force: true }).catch(() => undefined)
  return acquireSupervisorLock()
}

async function releaseSupervisorLock() {
  if (!holdsSupervisorLock) return
  holdsSupervisorLock = false
  await rm(supervisorLockPath, { force: true }).catch(() => undefined)
}

function eventPath() { return path.join(sessionRoot, 'events.ndjson') }
async function event(type, fields = {}) {
  const record = { at: new Date().toISOString(), type, ...fields }
  await appendFile(eventPath(), `${JSON.stringify(record)}\n`)
}
async function writeStatus() {
  const publicStatus = {
    version: 1, sessionId, deadline: deadline.toISOString(), generatedAt: new Date().toISOString(),
    state: stopping ? 'stopping' : 'running', evidence: path.relative(repositoryRoot, sessionRoot).replaceAll('\\', '/'),
    services: [...state.values()].map(({ id, route, port, state: serviceState, recoveryCount, owned, processId, listenerProcessId, latestProbe, conflict }) =>
      ({ id, route, port, state: serviceState, recoveryCount, owned, processId, listenerProcessId, latestProbe, conflict })),
  }
  await mkdir(outputRoot, { recursive: true })
  await writeFile(statusPath, `${JSON.stringify(publicStatus, null, 2)}\n`)
}

async function fetchDocument(port, pathname) {
  const response = await fetch(`http://localhost:${port}${pathname}`, { signal: AbortSignal.timeout(8_000), cache: 'no-store' })
  const content = await response.text()
  const marker = /(?:slidev|@slidev|__SLIDEV__)/i.test(content)
  return { ok: response.status === 200 && marker, status: response.status, marker }
}

async function probe(service) {
  const directPath = service.id === 'landing' ? '/' : deckBaseFor(service)
  const direct = await fetchDocument(service.port, directPath).catch((error) => ({ ok: false, error: safeError(error) }))
  const proxied = service.id === 'landing'
    ? direct
    : await fetchDocument(landingService.port, deckBaseFor(service)).catch((error) => ({ ok: false, error: safeError(error) }))
  const hmrPath = service.id === 'landing' ? '/' : deckBaseFor(service)
  const hmr = await probeHmr(`ws://localhost:${landingService.port}${hmrPath}`).catch((error) => ({ ok: false, error: safeError(error) }))
  return { at: new Date().toISOString(), ...evaluateReadiness({ direct, proxied, hmr }) }
}

async function portIsListening(port) {
  return (await listenerProcessForPort(port)) !== null
}

async function listenerProcessForPort(port) {
  try {
    const { stdout } = await execFile(process.platform === 'win32' ? 'netstat.exe' : 'sh', process.platform === 'win32' ? ['-ano', '-p', 'tcp'] : ['-lc', `lsof -ti tcp:${port}`])
    if (process.platform !== 'win32') return Number(stdout.trim()) || null
    const listener = stdout.split(/\r?\n/).find((line) => new RegExp(`:${port}\\s+.*LISTENING\\s+\\d+\\s*$`, 'i').test(line))
    const pid = listener?.trim().split(/\s+/).at(-1)
    return Number(pid) || null
  }
  catch { return null }
}

async function terminateOwned(service) {
  const detail = state.get(service.id)
  const child = children.get(service.id)
  const runnerProcessId = child?.exitCode === null ? child.pid : null
  // npm.cmd can end after spawning Slidev on Windows. Once readiness has
  // proved that its listener belongs to this session, the listener PID is the
  // durable ownership target; it prevents a later recovery from creating a
  // second server on the same port.
  const processId = ownedProcessTarget({ runnerProcessId, listenerProcessId: detail.listenerProcessId, owned: detail.owned })
  if (!processId) return false
  await event('owned-process-stop', { service: service.id, processId, runnerProcessId, listenerProcessId: detail.listenerProcessId })
  if (process.platform === 'win32') await execFile('taskkill.exe', ['/pid', String(processId), '/t', '/f']).catch(() => undefined)
  else if (child?.exitCode === null) child.kill('SIGTERM')
  children.delete(service.id)
  detail.owned = false
  detail.processId = null
  detail.listenerProcessId = null
  return true
}

async function startService(service) {
  const detail = state.get(service.id)
  const alreadyListening = await portIsListening(service.port)
  if (alreadyListening) {
    detail.state = 'blocked'
    detail.conflict = `Port ${service.port} is listening but does not pass the declared readiness probe; it was not started by this session.`
    await event('port-conflict', { service: service.id, port: service.port })
    return false
  }
  detail.state = 'starting'
  detail.conflict = null
  const logPrefix = path.join(sessionRoot, `${service.id}-${detail.recoveryCount}`)
  // Windows cannot directly spawn a .cmd file from Node. Use cmd.exe as the
  // owned parent so its entire npm/Slidev descendant tree can be stopped by
  // the ledger-backed taskkill call if, and only if, this session started it.
  const executable = process.platform === 'win32' ? (process.env.ComSpec ?? 'cmd.exe') : 'npm'
  const arguments_ = process.platform === 'win32'
    ? ['/d', '/s', '/c', 'npm.cmd', 'run', service.script]
    : ['run', service.script]
  const child = spawn(executable, arguments_, {
    cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
  })
  children.set(service.id, child)
  detail.owned = true
  detail.processId = child.pid
  detail.listenerProcessId = null
  await event('process-start', { service: service.id, processId: child.pid, script: service.script })
  child.stdout.pipe((await import('node:fs')).createWriteStream(`${logPrefix}.stdout.log`))
  child.stderr.pipe((await import('node:fs')).createWriteStream(`${logPrefix}.stderr.log`))
  child.once('exit', async (code, signal) => {
    await event('process-exit', { service: service.id, processId: child.pid, code, signal })
    if (children.get(service.id) === child) children.delete(service.id)
    if (!stopping) {
      detail.processId = null
      const outcome = await probe(service)
      detail.latestProbe = outcome
      if (outcome.ok) {
        detail.listenerProcessId = await listenerProcessForPort(service.port)
        detail.owned = detail.listenerProcessId !== null
        detail.state = 'ready'
        await event('runner-exit-listener-retained', { service: service.id, listenerProcessId: detail.listenerProcessId, code, signal })
      }
      else {
        detail.listenerProcessId = null
        detail.owned = false
        detail.state = 'recovering'
      }
      await writeStatus()
    }
  })
  return true
}

async function waitForReady(service, timeoutMs = 55_000) {
  const ends = Date.now() + timeoutMs
  while (Date.now() < ends && !stopping) {
    const outcome = await probe(service)
    const detail = state.get(service.id)
    detail.latestProbe = outcome
    // A deck's own Vite server can be ready before the landing proxy. When
    // the landing is recovering, waiting for that proxy here would stall this
    // sequential loop for every deck and postpone the one service that can
    // repair the proxy. The next normal probe upgrades this state to ready.
    if (outcome.ok || (service.id !== 'landing' && outcome.direct.ok)) {
      detail.state = outcome.ok ? 'ready' : 'waiting-for-landing'
      detail.conflict = null
      detail.listenerProcessId = await listenerProcessForPort(service.port)
      await event(outcome.ok ? 'ready' : 'direct-ready-waiting-for-landing', { service: service.id, port: service.port })
      return true
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000))
  }
  return false
}

async function ensureService(service) {
  const detail = state.get(service.id)
  const outcome = await probe(service)
  detail.latestProbe = outcome
  if (outcome.ok) {
    detail.state = 'ready'
    if (detail.owned) detail.listenerProcessId = await listenerProcessForPort(service.port)
    return true
  }
  if (service.id !== 'landing' && outcome.direct.ok) {
    detail.state = 'waiting-for-landing'
    return true
  }
  if (detail.state === 'blocked') return false
  if (children.has(service.id)) await terminateOwned(service)
  const decision = recoveryDecision({ recoveryCount: detail.recoveryCount, deadline })
  if (!decision.allowed) {
    detail.state = decision.state
    detail.conflict = decision.reason
    await event('recovery-blocked', { service: service.id, reason: decision.reason })
    return false
  }
  detail.recoveryCount += 1
  detail.state = 'recovering'
  await event('recovery-start', { service: service.id, recoveryCount: detail.recoveryCount, failedProbe: outcome })
  await new Promise((resolve) => setTimeout(resolve, decision.delayMs))
  if (!await startService(service)) return false
  const ready = await waitForReady(service)
  if (!ready) detail.state = 'failed'
  return ready
}

async function preflight() {
  const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'))
  const result = validateLivePreviewManifest(livePreviewManifest, packageJson.scripts)
  if (!result.valid) throw new Error(`Live preview manifest preflight failed:\n${result.errors.join('\n')}`)
}

async function stopOwnedServices() {
  // Shutdown is ledger-bound: only processes started by this supervisor are
  // candidates. This prevents a normal session end from orphaning a child,
  // while retaining the foreign-listener protection used during recovery.
  for (const service of [...services].reverse()) {
    await terminateOwned(service)
  }
}

async function restartForSourceSave(service) {
  if (stopping || service.id === 'landing') return
  const fingerprint = await sourceFingerprint(service).catch(() => null)
  if (!fingerprint || fingerprint === sourceFingerprints.get(service.id)) return
  sourceFingerprints.set(service.id, fingerprint)

  const detail = state.get(service.id)
  await event('source-save', { service: service.id, source: service.source })
  // A Slidev server can retain generated modules for the old slide ordering
  // after an external Markdown save. Recycle only a listener this supervisor
  // owns, which makes the visible deck reparse from the saved source without
  // touching a foreign authoring process.
  if (!detail.owned) {
    detail.conflict = 'Source changed, but this supervisor does not own the deck process to refresh it.'
    await writeStatus()
    return
  }
  await terminateOwned(service)
  detail.state = 'recovering'
  await startService(service)
  if (await waitForReady(service)) detail.conflict = null
  else detail.state = 'failed'
  await writeStatus()
}

async function beginSourceWatchers() {
  for (const service of livePreviewManifest) {
    sourceFingerprints.set(service.id, await sourceFingerprint(service).catch(() => null))
    const sourcePath = path.join(root, service.source)
    const directory = path.dirname(sourcePath)
    const filename = path.basename(sourcePath)
    const watcher = watch(directory, { persistent: false }, (_eventType, changed) => {
      if (String(changed ?? '') !== filename || stopping) return
      clearTimeout(sourceRestartTimers.get(service.id))
      sourceRestartTimers.set(service.id, setTimeout(() => {
        sourceRestartTimers.delete(service.id)
        restartForSourceSave(service).catch(async (error) => {
          const detail = state.get(service.id)
          detail.state = 'failed'
          detail.conflict = `Source-save refresh failed: ${safeError(error)}`
          await event('source-save-refresh-failed', { service: service.id, error: safeError(error) })
          await writeStatus()
        })
      }, 150))
    })
    sourceWatchers.push(watcher)
  }
}

function stopSourceWatchers() {
  for (const timer of sourceRestartTimers.values()) clearTimeout(timer)
  sourceRestartTimers.clear()
  for (const watcher of sourceWatchers) watcher.close()
  sourceWatchers.length = 0
}

async function run() {
  await acquireSupervisorLock()
  try {
    await mkdir(sessionRoot, { recursive: true })
    await preflight()
    await beginSourceWatchers()
    await writeFile(path.join(sessionRoot, 'ownership-ledger.json'), `${JSON.stringify({ sessionId, startedAt: new Date().toISOString(), services: services.map(({ id, script, port }) => ({ id, script, port })) }, null, 2)}\n`)
    await event('session-start', { deadline: deadline.toISOString(), durationHours })
    while (!stopping && Date.now() < deadline.getTime()) {
      // Landing is checked before and after all independent decks.
      await ensureService(landingService)
      for (const service of livePreviewManifest) await ensureService(service)
      await ensureService(landingService)
      await writeStatus()
      await new Promise((resolve) => setTimeout(resolve, intervalSeconds * 1_000))
    }
    stopping = true
    await event('session-stop', { reason: Date.now() >= deadline.getTime() ? 'deadline' : 'signal' })
    await writeStatus()
  }
  finally {
    stopping = true
    stopSourceWatchers()
    await stopOwnedServices()
    await releaseSupervisorLock()
  }
}

async function printStatus() {
  try { process.stdout.write(await readFile(statusPath, 'utf8')) }
  catch { process.stdout.write(`${JSON.stringify({ state: 'unavailable', message: 'No live preview status has been written.' })}\n`); process.exitCode = 1 }
}

async function soak() {
  await run()
  const reportRoot = path.join(repositoryRoot, 'output', 'reports', 'slidev-live-preview')
  await mkdir(reportRoot, { recursive: true })
  const summary = JSON.parse(await readFile(statusPath, 'utf8'))
  await writeFile(path.join(reportRoot, `soak-${sessionId}.json`), `${JSON.stringify({ ...summary, kind: 'soak-summary' }, null, 2)}\n`)
}

for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { stopping = true })
if (command === 'status') await printStatus()
else if (command === 'start') await run()
else if (command === 'soak') await soak()
else throw new Error(`Unknown live preview command: ${command}`)
