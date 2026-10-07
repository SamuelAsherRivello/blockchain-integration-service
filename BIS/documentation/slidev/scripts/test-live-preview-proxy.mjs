import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const origin = process.env.SLIDEV_PREVIEW_ORIGIN ?? 'http://localhost:3032'
const fixtureSource = new URL('../fixtures/live-preview-fixture.md', import.meta.url)
const fixtureRoute = `${origin}/slidev/live-preview-fixture/1`
const normalizedHash = (value) => createHash('sha256').update(value.replace(/\r\n/g, '\n').trim()).digest('hex')

test('navigation acknowledgement is source-neutral and the declared editor owner is writable', async () => {
  const before = normalizedHash(await readFile(fixtureSource, 'utf8'))
  const navigation = await fetch(`${origin}/@server-reactive/nav`, { method: 'POST', body: '{}' })
  assert.equal(navigation.status, 204)
  assert.equal(normalizedHash(await readFile(fixtureSource, 'utf8')), before)

  const headers = { referer: fixtureRoute }
  const read = await fetch(`${origin}/__slidev/slides/1.json`, { headers })
  assert.equal(read.status, 200)
  const payload = await read.json()
  const write = await fetch(`${origin}/__slidev/slides/1.json`, {
    method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify(payload),
  })
  assert.equal(write.status, 200)
  assert.equal(normalizedHash(await readFile(fixtureSource, 'utf8')), before)
})

test('editor writes without a declared owner are rejected', async () => {
  const response = await fetch(`${origin}/__slidev/slides/1.json`, {
    method: 'POST', headers: { referer: `${origin}/unknown/1`, 'content-type': 'application/json' }, body: '{}',
  })
  assert.equal(response.status, 409)
  assert.equal((await response.json()).error, 'SLIDEV_EDITOR_OWNER_UNKNOWN')
})
