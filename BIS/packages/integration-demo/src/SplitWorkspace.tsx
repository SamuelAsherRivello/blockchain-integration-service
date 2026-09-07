import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { readSplitPercent, saveSplitPercent, splitPercent } from './split-layout';

export function SplitWorkspace({ children }: { children: [ReactNode, ReactNode] }) {
  const workspace = useRef<HTMLElement>(null);
  const [percent, setPercent] = useState(() => readSplitPercent());
  const [width, setWidth] = useState(0);
  useEffect(() => { saveSplitPercent(percent); }, [percent]);
  useEffect(() => {
    const element = workspace.current!;
    const observer = new ResizeObserver(() => {
      const nextWidth = element.getBoundingClientRect().width;
      setWidth(nextWidth);
      if (nextWidth > 700) setPercent(value => splitPercent(value / 100 * nextWidth, nextWidth));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return <main ref={workspace} className="workspace" style={{ '--admin-width': `${percent}%` } as CSSProperties}>
    {children[0]}
    <div className="workspace-divider" role="separator" aria-label="Resize admin and runtime preview" aria-orientation="vertical"
      aria-valuemin={Math.round(splitPercent(0, width))} aria-valuemax={Math.round(splitPercent(width, width))} aria-valuenow={Math.round(percent)} tabIndex={0}
      onPointerDown={event => { if (event.button !== 0) return; event.preventDefault(); event.currentTarget.focus(); event.currentTarget.setPointerCapture(event.pointerId); }}
      onPointerMove={event => {
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
        const bounds = workspace.current!.getBoundingClientRect();
        setPercent(splitPercent(event.clientX - bounds.left - 5, bounds.width));
      }}
      onPointerUp={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }}
      onKeyDown={event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const position = event.key === 'Home' ? 0 : event.key === 'End' ? width : percent / 100 * width + (event.key === 'ArrowLeft' ? -20 : 20);
        setPercent(splitPercent(position, width));
      }} />
    {children[1]}
  </main>;
}
