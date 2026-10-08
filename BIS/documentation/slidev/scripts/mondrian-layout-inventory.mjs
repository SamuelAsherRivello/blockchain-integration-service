import { readFileSync } from 'node:fs'
import { basename, dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDirectory = dirname(fileURLToPath(import.meta.url))

export const slidevDirectory = resolve(scriptDirectory, '..')
export const expectedTheme = './themes/mondrian'

export function frontmatterMatches(source) {
  return [...source.matchAll(/(?:^|\r?\n)---\r?\n([\s\S]*?)\r?\n---(?=\r?\n|$)/g)]
}

export function field(block, name) {
  return block.match(new RegExp(`^${name}:\\s*(.*?)\\s*$`, 'm'))?.[1]
}

export function parseSlides(path) {
  const source = readFileSync(path, 'utf8')
  return frontmatterMatches(source).map((block, index) => {
    const frontmatter = {}
    for (const line of block[1].split(/\r?\n/)) {
      const match = line.match(/^([A-Za-z][A-Za-z0-9]*):\s*(.*?)\s*$/)
      if (match) frontmatter[match[1]] = match[2]
    }
    return { page: index + 1, frontmatter }
  })
}

export function catalogPages(source) {
  const pages = new Map()
  for (const [index, block] of frontmatterMatches(source).entries()) {
    const layout = field(block[1], 'catalogLayout')
    if (!layout) continue
    const examples = pages.get(layout) ?? []
    examples.push(index + 1)
    pages.set(layout, examples)
  }
  return pages
}

export function registeredPages(definition) {
  return definition.catalogSlides ?? [definition.catalogSlide]
}

function commandArgument(command, flag) {
  const match = command.match(new RegExp(`${flag}\\s+(?:"([^"]+)"|'([^']+)'|(\\S+))`))
  return match?.[1] ?? match?.[2] ?? match?.[3]
}

function slidevEntry(command) {
  const match = command.match(/\bslidev\s+(?:build\s+)?(?:"([^"]+\.md)"|'([^']+\.md)'|(\S+\.md))/)
  return match?.[1] ?? match?.[2] ?? match?.[3]
}

function resolveSlidevSource(path) {
  const visited = new Set()
  let currentPath = path
  while (true) {
    if (visited.has(currentPath))
      throw new Error(`Slidev src cycle detected: ${[...visited, currentPath].map((entry) => basename(entry)).join(' -> ')}.`)
    visited.add(currentPath)
    const source = readFileSync(currentPath, 'utf8')
    const firstFrontmatter = frontmatterMatches(source)[0]?.[1]
    const sourceReference = firstFrontmatter && field(firstFrontmatter, 'src')
    if (!sourceReference) return { path: currentPath, source }
    const resolvedReference = resolve(dirname(currentPath), sourceReference)
    const pathFromSlidev = relative(slidevDirectory, resolvedReference)
    if (pathFromSlidev.startsWith('..') || pathFromSlidev.includes(':'))
      throw new Error(`Slidev src entry ${sourceReference} resolves outside the documentation workspace.`)
    currentPath = resolvedReference
  }
}

export function declaredMondrianInventory() {
  const packagePath = resolve(slidevDirectory, 'package.json')
  const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'))
  const entries = new Map()

  for (const [scriptName, command] of Object.entries(packageJson.scripts ?? {})) {
    if (!/^(dev|build):/.test(scriptName)) continue
    const entry = slidevEntry(command)
    if (!entry || commandArgument(command, '--theme') !== expectedTheme) continue
    const entryPath = resolve(slidevDirectory, entry)
    const resolved = resolveSlidevSource(entryPath)
    const record = entries.get(resolved.path) ?? { path: resolved.path, source: resolved.source, scripts: [] }
    record.scripts.push(scriptName)
    entries.set(resolved.path, record)
  }

  const catalogCandidates = [...entries.values()].filter((entry) => catalogPages(entry.source).size > 0)
  if (catalogCandidates.length !== 1)
    throw new Error(`Expected exactly one declared Mondrian catalog, found ${catalogCandidates.length}.`)

  const catalog = catalogCandidates[0]
  const decks = [...entries.values()]
    .filter((entry) => entry.path !== catalog.path)
    .map((entry) => ({ ...entry, name: basename(entry.path, '.md') }))
    .sort((left, right) => left.name.localeCompare(right.name))

  if (!decks.length) throw new Error('No declared Mondrian content decks were found.')
  return { catalog, decks }
}
