import { cp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { publicPreviews } from './live-preview-manifest.mjs'

const slidevRoot = resolve(import.meta.dirname, '..')
const destination = resolve(slidevRoot, 'dist', 'public')
const template = await readFile(resolve(slidevRoot, 'launcher', 'index.html'), 'utf8')
const publicBase = '/blockchain-integration-service/slidev'

const links = Object.entries(Object.groupBy(publicPreviews(), (entry) => entry.group))
  .map(([group, entries]) => `<section aria-labelledby="${group.toLowerCase()}-heading"><h2 id="${group.toLowerCase()}-heading">${group}</h2>${entries.map((entry) => `<a href="${publicBase}/${entry.id}/1">${entry.label} <small>v${entry.version}</small></a>`).join('')}</section>`)
  .join('')

await mkdir(destination, { recursive: true })
await cp(resolve(slidevRoot, 'launcher', 'favicon-slidev-presentations.svg'), resolve(destination, 'favicon-slidev-presentations.svg'))
await writeFile(
  resolve(destination, 'index.html'),
  template
    .replace('href="/favicon-slidev-presentations.svg"', 'href="./favicon-slidev-presentations.svg"')
    .replace('<!-- preview-links -->', links),
)
