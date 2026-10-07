import assert from 'node:assert/strict'
import test from 'node:test'
import { classifyCoherenceFailure } from './live-preview-diagnostics.mjs'

test('classifies concise deck and slide diagnostics', () => {
  const result = classifyCoherenceFailure({
    id: 'deck', route: '/slidev/deck/7', slide: 7, revision: 'r7',
    hmr: { open: 0 }, message: 'generated-module mismatch deck/7: editor token is absent',
  })
  assert.deepEqual(result, {
    kind: 'generated-module', id: 'deck', route: '/slidev/deck/7', slide: 7, revision: 'r7',
    hmr: { open: 0 }, message: 'generated-module mismatch deck/7: editor token is absent',
  })
})

test('identifies HMR and transport evidence independently', () => {
  assert.equal(classifyCoherenceFailure({ message: 'render/HMR readiness failed: socket closed' }).kind, 'hmr')
  assert.equal(classifyCoherenceFailure({ message: 'transport mismatch deck/1: 502' }).kind, 'transport')
  assert.equal(classifyCoherenceFailure({ message: 'editor status/cache 409/no-store' }).kind, 'editor')
  assert.equal(classifyCoherenceFailure({ message: 'render mismatch deck/1: expected token' }).kind, 'render')
  assert.equal(classifyCoherenceFailure({ message: 'route navigation failed' }).kind, 'routing')
})
