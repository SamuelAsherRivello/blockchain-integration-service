import { useEffect, useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import bisDiagram from '../../../documentation/bis-concept-diagram-1.png';
import arkadeDiagram from '../../../documentation/bitcoin-ark-arkade-bis-game.png';
import source from '../stories/bis-project.arc.md?raw';
import { parseArc } from './arc';

const arc = parseArc(source);

function Visual({ name }: { name?: string }) {
  if (name === 'bis-diagram' || name === 'journey') return <img className="visual-image" src={bisDiagram} alt="BIS concept diagram" />;
  if (name === 'flow') return <img className="visual-image" src={arkadeDiagram} alt="Bitcoin, Ark, Arkade, BIS, and game relationship" />;
  if (name === 'assets') return <div className="visual-assets" aria-label="Equipment and achievement tokens"><span>SHIELD</span><span>TROPHY</span><span>DAGGER</span></div>;
  if (name === 'stealth') return <div className="visual-stealth"><span>STEALTH</span><strong>&amp; STEEL</strong><i>GAME CONSUMER</i></div>;
  if (name === 'github') return <div className="visual-code"><code>score.arc.md</code><b>→</b><code>React Stage</code><b>→</b><code>Pages</code></div>;
  if (name === 'map') return <div className="visual-map"><i>01</i><i>02</i><i>03</i><i>04</i><i>05</i><i>06</i></div>;
  return <div className="visual-signal"><span /><span /><span /><span /></div>;
}

export function ArcApp() {
  const [active, setActive] = useState(0);
  const scene = arc.scenes[active];
  const go = (next: number) => setActive(Math.max(0, Math.min(arc.scenes.length - 1, next)));
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight' || event.key === ' ') go(active + 1);
      if (event.key === 'ArrowLeft') go(active - 1);
      if (event.key === 'Home') go(0);
      if (event.key === 'End') go(arc.scenes.length - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active]);
  return <main className={`arc theme-${arc.theme}`}>
    <header className="arc-controls">
      <a href="https://github.com/SamuelAsherRivello/blockchain-integration-service">BIS</a>
      <span>{arc.title}</span>
      <button onClick={() => document.documentElement.requestFullscreen?.()} aria-label="Present full screen">Present</button>
    </header>
    <section className={`stage layout-${scene.layout}`} aria-label={`Scene ${active + 1} of ${arc.scenes.length}`}>
      <div className="scene-copy">
        <p className="eyebrow">{scene.eyebrow ?? 'PROJECT ARC'}</p>
        <Markdown remarkPlugins={[remarkGfm]}>{scene.markdown}</Markdown>
      </div>
      <div className="scene-visual"><Visual name={scene.visual} /></div>
      <footer><span>{String(active + 1).padStart(2, '0')} / {String(arc.scenes.length).padStart(2, '0')}</span><span>PROJECT ARC</span></footer>
    </section>
    <nav className="arc-navigation" aria-label="Scene navigation">
      <button onClick={() => go(active - 1)} disabled={active === 0}>Previous</button>
      <div className="scene-dots">{arc.scenes.map((entry, index) => <button key={index} className={index === active ? 'active' : ''} onClick={() => go(index)} aria-label={`Go to scene ${index + 1}: ${entry.eyebrow ?? entry.layout}`} />)}</div>
      <button onClick={() => go(active + 1)} disabled={active === arc.scenes.length - 1}>Next</button>
    </nav>
  </main>;
}
