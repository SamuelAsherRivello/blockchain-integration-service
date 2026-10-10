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
  async function writeClipboard(text: string) {
    const copyWithSelection = () => {
      if (typeof document === 'undefined') return false;
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        return document.execCommand('copy');
      } finally {
        textarea.remove();
      }
    };
    // Keep this synchronous for HTTP/embedded previews: execCommand must run
    // inside the original click gesture or the browser may reject the copy.
    if (copyWithSelection()) return;
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await Promise.race([
          navigator.clipboard.writeText(text),
          new Promise<never>((_, reject) => window.setTimeout(() => reject(new Error('Clipboard write timed out.')), 250)),
        ]);
        return;
      }
    } catch {
      // Embedded previews can expose navigator.clipboard but reject writes from
      // their browsing context. Try the native selection fallback below.
    }
    throw new Error('Clipboard unavailable.');
  }
  async function copy() {
    if (!alive.current || disabled || working.current) return;
    const text = value();
    if (!text) return;
    const current = ++generation.current;
    const valid = () => alive.current && current === generation.current;
    working.current = true; setStatus('copying');
    try {
      await writeClipboard(text);
      if (valid()) { setHasCopied(true); setStatus('copied'); }
    } catch { if (valid()) setStatus('failed'); }
    finally { if (valid()) working.current = false; }
  }
  return { status, hasCopied, copy };
}
export type ClipboardCopy = ReturnType<typeof useClipboardCopy>;
