import { cp, mkdir, readFile, rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import { spawn } from 'node:child_process'
import { publicPreviews } from './live-preview-manifest.mjs'

const slidevRoot = resolve(import.meta.dirname, '..')
const destination = resolve(slidevRoot, 'dist', 'public')
const pagesBase = '/blockchain-integration-service/slidev'
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx'

async function renderedSlideCount(source) {
  const content = await readFile(resolve(slidevRoot, source), 'utf8')
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(content)
  const delegatedSource = frontmatter?.[1].match(/^src:\s*\.\/(.+)$/m)?.[1]
  if (delegatedSource) return renderedSlideCount(delegatedSource)
  const body = frontmatter ? content.slice(frontmatter[0].length) : content
  return 1 + (body.match(/^---\s*$/gm) ?? []).length
}

async function materializeDeepLinks(deck) {
  const deckOutput = resolve(destination, deck.id)
  const shell = resolve(deckOutput, 'index.html')
  const total = await renderedSlideCount(deck.source)
  await Promise.all(Array.from({ length: total }, async (_, index) => {
    const slideDirectory = resolve(deckOutput, String(index + 1))
    await mkdir(slideDirectory, { recursive: true })
    await cp(shell, resolve(slideDirectory, 'index.html'))
  }))
}

await rm(destination, { recursive: true, force: true })
await mkdir(destination, { recursive: true })

for (const deck of publicPreviews()) {
  await new Promise((resolveBuild, rejectBuild) => {
    const child = spawn(npx, ['slidev', 'build', deck.source, '--theme', deck.theme, '--base', `${pagesBase}/${deck.id}/`, '--out', `dist/public/${deck.id}`], {
      cwd: slidevRoot, shell: process.platform === 'win32',
      stdio: 'inherit',
    })
    child.once('error', rejectBuild)
    child.once('exit', (code) => code === 0 ? resolveBuild() : rejectBuild(new Error(`${deck.id}: Slidev build exited ${code}`)))
  })
  // Slidev preserves frontmatter image URLs such as `./assets/...` instead of
  // bundling them. Publish the shared source tree beneath every deck base so
  // those URLs resolve on GitHub Pages as well as in local preview.
  await cp(resolve(slidevRoot, 'assets'), resolve(destination, deck.id, 'assets'), { recursive: true })
  await materializeDeepLinks(deck)
}

await import('./build-public-landing.mjs')
