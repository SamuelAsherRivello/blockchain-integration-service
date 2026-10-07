import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { frontmatterMatches, slidevDirectory } from './mondrian-layout-inventory.mjs'

const [deckArgument, pageArgument] = process.argv.slice(2)
const page = Number(pageArgument)

if (!deckArgument || !Number.isInteger(page) || page < 1) {
  console.error('Usage: node scripts/inspect-slide-boundary.mjs <deck.md> <one-based-rendered-page>')
  process.exit(1)
}

const deckPath = resolve(slidevDirectory, deckArgument)
const source = readFileSync(deckPath, 'utf8')
const slides = frontmatterMatches(source)

if (page > slides.length) {
  console.error(`Rendered page ${page} is outside ${deckArgument} (1-${slides.length}).`)
  process.exit(1)
}

function field(frontmatter, name) {
  return frontmatter.match(new RegExp(`^${name}:\\s*(.*?)\\s*$`, 'm'))?.[1]
}

function titleAt(index) {
  if (index < 0 || index >= slides.length) return '(none)'
  const body = source.slice(slides[index].index + slides[index][0].length, slides[index + 1]?.index)
  const heading = body.match(/^#{1,6}\s+(.+)$/m)?.[1]
  const contentSlideId = field(slides[index][1], 'contentSlideId')
  return heading ?? contentSlideId ?? '(untitled)'
}

console.log(`Insertion boundary after rendered page ${page} (route /${page - 1}):`)
for (const index of [page - 2, page - 1, page]) {
  const label = index === page - 1 ? 'current' : index < page - 1 ? 'previous' : 'next'
  console.log(`- ${label}: page ${index + 1}, ${titleAt(index)}`)
}
