import { useState, type RefObject } from 'react';
export function GamePreview({ containerRef }: { containerRef: RefObject<HTMLDivElement | null> }) {
  const [scale, setScale] = useState(0.5);
  return <section className="preview-panel" aria-label="Runtime Preview">
    <div className="preview-heading"><h2 className="panel-title">Runtime Preview</h2><div className="preview-controls"><span className="aspect-tag">9 : 16</span><select className="preview-scale" aria-label="Runtime preview scale" value={scale} onChange={event => setScale(Number(event.target.value))}><option value={1}>100%</option><option value={0.5}>50%</option><option value={0.25}>25%</option></select></div></div>
    <div className="preview-stage"><div className="game-viewport"><div className="game-placeholder" aria-hidden="true"><span>＋</span>Game Viewport</div><div className="runtime-scale-layer" style={{ width: `${100 / scale}%`, height: `${100 / scale}%`, transform: `scale(${scale})` }}><div className="runtime-container" ref={containerRef} /></div></div></div>
  </section>;
}
