import test from 'node:test'
import assert from 'node:assert/strict'
import { evaluateReadiness } from './live-preview-readiness.mjs'

test('a document-only response cannot satisfy layered readiness', () => {
  const result = evaluateReadiness({ direct: { ok: true }, proxied: { ok: true }, hmr: { ok: false, error: 'socket failed' } })
  assert.equal(result.ok, false)
})

test('layered readiness requires direct, proxied, marker, and HMR success', () => {
  const result = evaluateReadiness({ direct: { ok: true, marker: true }, proxied: { ok: true, marker: true }, hmr: { ok: true } })
  assert.equal(result.ok, true)
})
