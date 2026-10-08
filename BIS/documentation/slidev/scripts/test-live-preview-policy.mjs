import assert from 'node:assert/strict'
import test from 'node:test'
import { MAX_RECOVERY_ATTEMPTS, createServiceState, listenerProcessIdFromNetstat, ownedProcessTarget, rearmRecoveryAfterEdit, recoveryDecision } from './live-preview-policy.mjs'

test('initializes declared service state', () => {
  assert.deepEqual(createServiceState({ id: 'deck', port: 3042 }, '/slidev/deck/1'), {
    id: 'deck', route: '/slidev/deck/1', port: 3042, state: 'declared', recoveryCount: 0, owned: false,
    processId: null, listenerProcessId: null, latestProbe: null, conflict: null,
  })
})

test('bounds recovery and observes the session deadline', () => {
  const deadline = new Date('2026-10-07T12:00:00.000Z')
  assert.deepEqual(recoveryDecision({ recoveryCount: 0, deadline, now: Date.parse('2026-10-07T11:00:00.000Z') }), { allowed: true, delayMs: 500 })
  assert.equal(recoveryDecision({ recoveryCount: MAX_RECOVERY_ATTEMPTS, deadline, now: Date.parse('2026-10-07T11:00:00.000Z') }).state, 'failed')
  assert.match(recoveryDecision({ recoveryCount: 0, deadline, now: Date.parse('2026-10-07T12:00:00.000Z') }).reason, /deadline/)
})

test('a saved fix rearms a deck after its recovery limit', () => {
  const deadline = new Date('2026-10-07T12:00:00.000Z')
  const now = Date.parse('2026-10-07T11:00:00.000Z')
  const detail = { recoveryCount: MAX_RECOVERY_ATTEMPTS, state: 'failed', conflict: 'Recovery limit reached' }
  assert.equal(recoveryDecision({ recoveryCount: detail.recoveryCount, deadline, now }).allowed, false)
  rearmRecoveryAfterEdit(detail)
  assert.deepEqual(detail, { recoveryCount: 0, state: 'recovering', conflict: null })
  assert.equal(recoveryDecision({ recoveryCount: detail.recoveryCount, deadline, now }).allowed, true)
})

test('only targets processes proven owned by the current supervisor', () => {
  assert.equal(ownedProcessTarget({ runnerProcessId: 10, listenerProcessId: 20, owned: true }), 10)
  assert.equal(ownedProcessTarget({ runnerProcessId: null, listenerProcessId: 20, owned: true }), 20)
  assert.equal(ownedProcessTarget({ runnerProcessId: null, listenerProcessId: 20, owned: false }), null)
})

test('finds IPv4 and IPv6 Windows listeners', () => {
  const output = [
    '  TCP    127.0.0.1:3032       0.0.0.0:0              LISTENING       1234',
    '  TCP    [::1]:3053           [::]:0                 LISTENING       5678',
  ].join('\r\n')
  assert.equal(listenerProcessIdFromNetstat(output, 3032), 1234)
  assert.equal(listenerProcessIdFromNetstat(output, 3053), 5678)
  assert.equal(listenerProcessIdFromNetstat(output, 9999), null)
})
