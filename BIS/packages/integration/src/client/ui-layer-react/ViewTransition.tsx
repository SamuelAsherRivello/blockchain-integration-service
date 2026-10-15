import { useEffect, useLayoutEffect, useRef, useState, type AnimationEvent, type ReactNode } from 'react';

type ViewSurface = { key: string; node: ReactNode };

type ViewTransitionProps = {
  viewKey: string;
  children: ReactNode;
};

export function ViewTransition({ viewKey, children }: ViewTransitionProps) {
  const [reducedMotion, setReducedMotion] = useState(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [activeKey, setActiveKey] = useState(viewKey);
  const [outgoing, setOutgoing] = useState<ViewSurface>();
  const committed = useRef<ViewSurface>({ key: viewKey, node: children });

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener?.('change', update);
    return () => media.removeEventListener?.('change', update);
  }, []);

  useLayoutEffect(() => {
    if (activeKey === viewKey) return;
    const previous = committed.current;
    setOutgoing(reducedMotion ? undefined : previous);
    setActiveKey(viewKey);
    committed.current = { key: viewKey, node: children };
  }, [activeKey, children, reducedMotion, viewKey]);

  useLayoutEffect(() => {
    if (activeKey === viewKey) committed.current = { key: viewKey, node: children };
  }, [activeKey, children, viewKey]);

  useEffect(() => {
    if (reducedMotion) setOutgoing(undefined);
  }, [reducedMotion]);

  const finishExit = (event: AnimationEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget || event.animationName !== 'bis-view-exit') return;
    const key = event.currentTarget.dataset.viewKey;
    setOutgoing(previous => previous?.key === key ? undefined : previous);
  };

  const activeNode = activeKey === viewKey ? children : committed.current.node;
  return <div className="bis-view-transition">
    {outgoing && <div className="bis-view-transition-surface bis-view-transition-exit" data-view-key={outgoing.key} inert aria-hidden="true" onAnimationEnd={finishExit}>{outgoing.node}</div>}
    {activeNode !== null && activeNode !== undefined && <div key={activeKey} className="bis-view-transition-surface bis-view-transition-enter" data-view-key={activeKey}>{activeNode}</div>}
  </div>;
}
