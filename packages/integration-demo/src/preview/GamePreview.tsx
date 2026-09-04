import { useEffect, useState, type RefObject } from 'react';

const scaleStorageKey = 'bis.integration-demo.preview-scale';

export function GamePreview({ containerRef }: { containerRef: RefObject<HTMLDivElement | null> }) {
  const [scale, setScale] = useState(() => {
    try {
      const saved = Number(localStorage.getItem(scaleStorageKey));
      if (saved === 1 || saved === 0.5 || saved === 0.25) return saved;
    } catch { /* Storage may be unavailable; use the default scale. */ }
    return 0.5;
  });
  useEffect(() => {
    try { localStorage.setItem(scaleStorageKey, String(scale)); }
    catch { /* Keep the scale control usable when storage is unavailable. */ }
  }, [scale]);
  return <section className="preview-panel" aria-label="Runtime Preview">
    <div className="preview-heading"><h2 className="panel-title">Runtime Preview</h2><div className="preview-controls"><span className="aspect-tag">9 : 16</span><select className="preview-scale" aria-label="Runtime preview scale" value={scale} onChange={event => setScale(Number(event.target.value))}><option value={1}>100%</option><option value={0.5}>50%</option><option value={0.25}>25%</option></select></div></div>
    <div className="preview-stage"><div className="game-viewport"><div className="game-placeholder" aria-hidden="true"><span>＋</span>Game Viewport</div><div className="runtime-scale-layer" style={{ width: `${100 / scale}%`, height: `${100 / scale}%`, transform: `scale(${scale})` }}><div className="runtime-container" ref={containerRef} /></div></div></div>
  </section>;
}
