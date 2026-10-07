export function evaluateReadiness({ direct, proxied, hmr }) {
  return {
    ok: Boolean(direct?.ok && proxied?.ok && hmr?.ok),
    direct,
    proxied,
    hmr,
  }
}

export async function probeHmr(url, timeoutMs = 8_000) {
  return await new Promise((resolve) => {
    let settled = false
    let socket
    const finish = (result) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      socket?.close()
      resolve(result)
    }
    const timeout = setTimeout(() => finish({ ok: false, error: `WebSocket did not open within ${timeoutMs}ms` }), timeoutMs)
    try {
      socket = new WebSocket(url, 'vite-hmr')
      socket.addEventListener('open', () => finish({ ok: true }))
      socket.addEventListener('error', () => finish({ ok: false, error: 'WebSocket connection failed' }))
    }
    catch (error) {
      finish({ ok: false, error: error instanceof Error ? error.message : String(error) })
    }
  })
}
