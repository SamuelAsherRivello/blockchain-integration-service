import { useLayoutEffect, useRef, type ButtonHTMLAttributes } from 'react';

/** Keep the normal font size unless the complete label needs less space. */
export function FitTextButton({ children, className = '', ...props }: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & { children: string }) {
  const button = useRef<HTMLButtonElement>(null), label = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const element = button.current!, text = label.current!;
    const fit = () => {
      text.style.fontSize = '';
      const style = getComputedStyle(element);
      const available = element.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      // offsetWidth uses layout pixels, so preview transforms do not distort the ratio.
      const needed = text.offsetWidth;
      if (needed > available && available > 0) {
        text.style.fontSize = `${parseFloat(getComputedStyle(text).fontSize) * Math.max(0, available - 1) / needed}px`;
      }
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(element);
    document.fonts.addEventListener('loadingdone', fit);
    window.addEventListener('resize', fit);
    return () => { observer.disconnect(); document.fonts.removeEventListener('loadingdone', fit); window.removeEventListener('resize', fit); };
  }, [children]);
  return <button {...props} ref={button} className={`bis-button bis-fit-text-button ${className}`.trim()}><span ref={label}>{children}</span></button>;
}
