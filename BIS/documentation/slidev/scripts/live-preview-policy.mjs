export const MAX_RECOVERY_ATTEMPTS = 5

export function createServiceState(service, route) {
  return {
    id: service.id, route, port: service.port,
    state: 'declared', recoveryCount: 0, owned: false,
    processId: null, listenerProcessId: null, latestProbe: null, conflict: null,
  }
}

export function recoveryDecision({ recoveryCount, deadline, now = Date.now() }) {
  if (now >= deadline.getTime()) return { allowed: false, state: 'failed', reason: 'The stable-preview session deadline has expired.' }
  if (recoveryCount >= MAX_RECOVERY_ATTEMPTS) return { allowed: false, state: 'failed', reason: `Recovery limit of ${MAX_RECOVERY_ATTEMPTS} attempts reached.` }
  return { allowed: true, delayMs: Math.min(5_000, (recoveryCount + 1) * 500) }
}

export function ownedProcessTarget({ runnerProcessId, listenerProcessId, owned }) {
  return runnerProcessId ?? (owned ? listenerProcessId : null)
}
