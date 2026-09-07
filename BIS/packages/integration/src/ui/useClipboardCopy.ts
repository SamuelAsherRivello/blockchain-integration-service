import { useLayoutEffect, useRef, useState } from 'react';

type CopyStatus = 'idle' | 'copying' | 'copied' | 'failed';
/** Values remain private to the caller. Scope changes invalidate feedback, including A → B → A. */
export function useClipboardCopy(value: () => string | undefined, scope: unknown, disabled = false) {
  const [status, setStatus] = useState<CopyStatus>('idle');
  const [hasCopied, setHasCopied] = useState(false);
  const generation = useRef(0), working = useRef(false), alive = useRef(false);
  useLayoutEffect(() => {
    alive.current = true;
    generation.current++;
    working.current = false;
    setStatus('idle'); setHasCopied(false);
    return () => { alive.current = false; generation.current++; working.current = false; };
  }, [scope, disabled]);
  async function copy() {
    if (!alive.current || disabled || working.current) return;
    const text = value();
    if (!text) return;
    const current = ++generation.current;
    const valid = () => alive.current && current === generation.current;
    working.current = true; setStatus('copying');
    try {
      await navigator.clipboard.writeText(text);
      if (valid()) { setHasCopied(true); setStatus('copied'); }
    } catch { if (valid()) setStatus('failed'); }
    finally { if (valid()) working.current = false; }
  }
  return { status, hasCopied, copy };
}
export type ClipboardCopy = ReturnType<typeof useClipboardCopy>;
