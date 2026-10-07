import assert from 'node:assert/strict'
import test from 'node:test'
import { MAX_RECOVERY_ATTEMPTS, createServiceState, ownedProcessTarget, recoveryDecision } from './live-preview-policy.mjs'

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

test('only targets processes proven owned by the current supervisor', () => {
  assert.equal(ownedProcessTarget({ runnerProcessId: 10, listenerProcessId: 20, owned: true }), 10)
  assert.equal(ownedProcessTarget({ runnerProcessId: null, listenerProcessId: 20, owned: true }), 20)
  assert.equal(ownedProcessTarget({ runnerProcessId: null, listenerProcessId: 20, owned: false }), null)
})
