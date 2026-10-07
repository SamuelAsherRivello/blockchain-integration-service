export function classifyCoherenceFailure({ id, route, slide, revision, message, hmr }) {
  const text = String(message ?? '')
  const kind = /editor status|editor record|fixture save/i.test(text) ? 'editor'
    : /generated-module/i.test(text) ? 'generated-module'
      : /render mismatch|canvas=/i.test(text) ? 'render'
        : /HMR|socket/i.test(text) ? 'hmr'
          : /transport|\b(404|409|502|504)\b/i.test(text) ? 'transport'
            : /route|navigation/i.test(text) ? 'routing'
              : 'coherence'
  return {
    kind, id, route, slide, revision: revision ?? null,
    hmr: hmr ?? null, message: text,
  }
}
