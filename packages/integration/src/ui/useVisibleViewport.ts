import { useLayoutEffect, useRef } from 'react';

/** Keep a host-local runtime inside the visible viewport when a mobile keyboard opens. */
export function useVisibleViewport() {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const runtime = ref.current!, host = runtime.parentElement!;
    const viewport = window.visualViewport;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const bounds = host.getBoundingClientRect();
        const scaleX = bounds.width / host.offsetWidth || 1;
        const scaleY = bounds.height / host.offsetHeight || 1;
        const left = Math.max(bounds.left, viewport?.offsetLeft ?? 0);
        const top = Math.max(bounds.top, viewport?.offsetTop ?? 0);
        const right = Math.min(bounds.right, (viewport?.offsetLeft ?? 0) + (viewport?.width ?? innerWidth));
        const bottom = Math.min(bounds.bottom, (viewport?.offsetTop ?? 0) + (viewport?.height ?? innerHeight));
        Object.assign(runtime.style, {
          left: `${Math.max(0, left - bounds.left) / scaleX}px`,
          top: `${Math.max(0, top - bounds.top) / scaleY}px`,
          right: `${Math.max(0, bounds.right - right) / scaleX}px`,
          bottom: `${Math.max(0, bounds.bottom - bottom) / scaleY}px`,
        });
        const active = document.activeElement;
        if (active instanceof HTMLInputElement && runtime.contains(active)) {
          // Scroll only the containing card: scrolling the document can move the game.
          const card = active.closest<HTMLElement>('.bis-card');
          if (card) {
            const inputBounds = active.getBoundingClientRect(), cardBounds = card.getBoundingClientRect();
            if (inputBounds.bottom > cardBounds.bottom - 8) card.scrollTop += (inputBounds.bottom - cardBounds.bottom + 8) / scaleY;
            else if (inputBounds.top < cardBounds.top + 8) card.scrollTop -= (cardBounds.top + 8 - inputBounds.top) / scaleY;
          }
        }
      });
    };
    const observer = new ResizeObserver(update); observer.observe(host);
    window.addEventListener('resize', update);
    viewport?.addEventListener('resize', update); viewport?.addEventListener('scroll', update);
    runtime.addEventListener('focusin', update);
    update();
    return () => {
      cancelAnimationFrame(frame); observer.disconnect();
      window.removeEventListener('resize', update);
      viewport?.removeEventListener('resize', update); viewport?.removeEventListener('scroll', update);
      runtime.removeEventListener('focusin', update);
    };
  }, []);
  return ref;
}
