import assert from 'node:assert/strict'
import test from 'node:test'
import { fingerprintEditorRecord, scanWithStableSource } from './live-preview-coherence.mjs'

test('normalizes editor records before fingerprinting', () => {
  assert.equal(
    fingerprintEditorRecord({ content: 'one\r\ntwo\n', revision: 3 }),
    fingerprintEditorRecord({ content: 'one\ntwo', revision: 3 }),
  )
})

test('retries a scan when the source changes during enumeration', async () => {
  let source = 'before'
  let scans = 0
  const result = await scanWithStableSource({
    readSource: async () => source,
    scan: async () => {
      scans += 1
      if (scans === 1) source = 'after'
      return { records: ['slide-1'] }
    },
  })
  assert.equal(scans, 2)
  assert.equal(result.attempts, 2)
  assert.deepEqual(result.records, ['slide-1'])
})

test('rejects an unstable source instead of reporting a false mismatch', async () => {
  let sequence = 0
  await assert.rejects(
    scanWithStableSource({
      attempts: 2,
      readSource: async () => String(sequence),
      scan: async () => { sequence += 1; return { records: [] } },
    }),
    /Source changed/,
  )
})
