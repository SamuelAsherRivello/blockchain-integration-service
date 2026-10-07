import { mkdir, rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import { spawn } from 'node:child_process'
import { publicPreviews } from './live-preview-manifest.mjs'

const slidevRoot = resolve(import.meta.dirname, '..')
const destination = resolve(slidevRoot, 'dist', 'public')
const pagesBase = '/blockchain-integration-service/slidev'
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx'

await rm(destination, { recursive: true, force: true })
await mkdir(destination, { recursive: true })

for (const deck of publicPreviews()) {
  await new Promise((resolveBuild, rejectBuild) => {
    const child = spawn(npx, ['slidev', 'build', deck.source, '--theme', deck.theme, '--base', `${pagesBase}/${deck.id}/`, '--out', `dist/public/${deck.id}`], {
      cwd: slidevRoot,
      stdio: 'inherit',
    })
    child.once('error', rejectBuild)
    child.once('exit', (code) => code === 0 ? resolveBuild() : rejectBuild(new Error(`${deck.id}: Slidev build exited ${code}`)))
  })
}

await import('./build-public-landing.mjs')
