import { GameOverlay } from '@bis/integration';
import '@bis/integration/style.css';

export function GamePreview() {
  return (
    <section className="preview-panel" aria-labelledby="preview-title">
      <div className="preview-heading"><h2 id="preview-title">Runtime preview</h2><span className="aspect-tag">9 : 16</span></div>
      <div className="preview-stage">
        <div className="game-viewport" aria-label="Game viewport">
          <div className="game-placeholder" aria-hidden="true"><span className="viewport-cross">＋</span><span>GAME VIEWPORT</span></div>
          <GameOverlay />
        </div>
      </div>
      <p className="preview-caption">Production overlay · Portrait host</p>
    </section>
  );
}
