import { useLayoutEffect, type ButtonHTMLAttributes } from 'react';

type ElementRef = { current: HTMLElement | null };

/** Keep every production BIS label readable when its button is constrained. */
export function useFitTextButtons(root: ElementRef) {
  useLayoutEffect(() => {
    const runtime = root.current;
    if (!runtime) return;
    let frame = 0;
    const fit = () => {
      runtime.querySelectorAll<HTMLElement>('.bis-button').forEach(button => {
        button.style.removeProperty('font-size');
        const style = getComputedStyle(button);
        const padding = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
        const available = button.clientWidth - padding;
        const needed = button.scrollWidth - padding;
        const normalSize = parseFloat(style.fontSize);
        if (available > 0 && needed > available + 0.1 && normalSize > 0) {
          button.style.fontSize = `${normalSize * Math.max(0, available - 0.8) / needed}px`;
        }
      });
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(fit);
    };
    const resize = new ResizeObserver(schedule);
    const observeButtons = () => runtime.querySelectorAll<HTMLElement>('.bis-button').forEach(button => resize.observe(button));
    const mutations = new MutationObserver(() => { observeButtons(); schedule(); });
    resize.observe(runtime);
    mutations.observe(runtime, { childList: true, subtree: true, characterData: true });
    document.fonts.addEventListener('loadingdone', schedule);
    observeButtons();
    schedule();
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      mutations.disconnect();
      document.fonts.removeEventListener('loadingdone', schedule);
    };
  }, [root]);
}

/** Preserve the explicit wrapper used by compact action rows. */
export function FitTextButton({ children, className = '', ...props }: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & { children: string }) {
  return <button {...props} className={`bis-button bis-fit-text-button ${className}`.trim()}><span>{children}</span></button>;
}
