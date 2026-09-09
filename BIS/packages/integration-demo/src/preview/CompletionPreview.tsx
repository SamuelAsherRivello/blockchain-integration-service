import { useEffect, useState } from 'react';
import { createBisAssetCollection, type BisContext, type BisAssetCollectionState } from '@bis/integration';
import { achievementPresets } from '../admin/achievement-presets';
import './completion-preview.css';

export function CompletionPreview({context, onRestart, onBusy}: {context: BisContext; onRestart(): void; onBusy(busy: boolean): void}) {
  const [level, setLevel] = useState(1);
  const [controller, setController] = useState<ReturnType<typeof createBisAssetCollection>>();
  const [state, setState] = useState<BisAssetCollectionState>();
  useEffect(() => {
    const current = createBisAssetCollection(context, {asset: achievementPresets[level - 1]!, successMessage: `Level ${level} trophy collected!`});
    setController(current); setState(current.getState());
    const update = () => { setState(current.getState()); onBusy(current.getState().busy); };
    const unsubscribe = current.subscribe(update);
    void context.ready().then(() => current.refresh());
    return () => { unsubscribe(); current.dispose(); onBusy(false); };
  }, [context, level, onBusy]);
  const final = level === 2, busy = !state || state.busy;
  const message = state?.status === 'owned' ? 'You already own this trophy.'
    : state?.status === 'guest' ? 'Log in to collect this trophy.' : state?.message;
  const act = (callback: () => void) => { if (!busy && !state?.needsAcknowledgment) callback(); };
  return <div className="completion-preview" onKeyDown={event => {
    event.stopPropagation();
    if (event.key === 'Escape') event.preventDefault();
    if (event.key === 'Tab') {
      const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
      event.preventDefault();
      buttons[(buttons.indexOf(document.activeElement as HTMLButtonElement) + (event.shiftKey ? buttons.length - 1 : 1)) % buttons.length]?.focus();
    }
  }}>
    <section className="completion-card" role="dialog" aria-modal="true" aria-labelledby="completion-title" aria-describedby="completion-body" aria-busy={busy}>
      <span className="completion-kicker">{final ? 'All levels complete' : `Level ${level} of 2`}</span>
      <h2 id="completion-title">{final ? 'Game Completed' : 'Level Completed'}</h2>
      <p id="completion-body" aria-live="polite">{final ? 'Great jobs. You completed 2/2 levels. You collected 75/100 gold in the final level and reached the exit.' : 'Great jobs. You collected 25/100 gold and reached the exit.'}{message ? ` ${message}` : ''}</p>
      {state?.needsAcknowledgment ? <button autoFocus onClick={() => void controller?.acknowledge()}>OK</button> : <>
        <button className="completion-collect" disabled={!state?.canCollect} onClick={() => void controller?.collect()}>Collect Level {level} Trophy</button>
        {state?.canCheck && <button className="completion-check" onClick={() => void controller?.check()}>{state.status === 'uncertain' ? 'Check Trophy Status' : 'Check Trophy Ownership'}</button>}
        {!final && <button disabled={busy} onClick={() => act(() => setLevel(2))}>Continue To Next Level</button>}
        <button disabled={busy} onClick={() => act(onRestart)}>Restart Game</button>
      </>}
    </section>
  </div>;
}
