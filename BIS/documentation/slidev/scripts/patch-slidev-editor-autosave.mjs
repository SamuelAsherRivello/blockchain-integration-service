import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const editorPath = fileURLToPath(new URL('../node_modules/@slidev/client/internals/SideEditor.vue', import.meta.url))
const source = await readFile(editorPath, 'utf8')
const patched = source
  .replace("import { throttledWatch, useEventListener } from '@vueuse/core'", "import { debouncedWatch, useEventListener } from '@vueuse/core'")
  .replace('throttledWatch(\n  [content, note],', 'debouncedWatch(\n  [content, note],')
  .replace('{ throttle: 500 },\n)', '{ debounce: 2_000, maxWait: 10_000 },\n)')

if (patched === source) {
  if (source.includes('debouncedWatch') && source.includes('debounce: 2_000')) process.exit(0)
  throw new Error('Unsupported Slidev SideEditor source: autosave patch did not match.')
}

await writeFile(editorPath, patched)
