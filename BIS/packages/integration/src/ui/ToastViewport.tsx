import { useEffect, useLayoutEffect, useState, useSyncExternalStore, type CSSProperties } from 'react';
import { getControls, type BisContext } from '../core/context';
import type { ToastEntry } from '../core/toasts';
import { startToastPlayback, TOAST_MOTION_MS, type ToastPhase } from './toast-playback';
import { prepareToastImage } from './toast-image';

const reducedMotionQuery = '(prefers-reduced-motion: reduce)';
const readReducedMotion = () => window.matchMedia(reducedMotionQuery).matches;
const noReducedMotion = () => false;
function subscribeReducedMotion(listener: () => void) {
  const media = window.matchMedia(reducedMotionQuery);
  media.addEventListener('change', listener);
  return () => media.removeEventListener('change', listener);
}

function ToastCard({ entry, reducedMotion, complete, imageUrl }: { entry: ToastEntry; reducedMotion: boolean; complete(id: number): void; imageUrl?: string }) {
  const [phase, setPhase] = useState<ToastPhase>(reducedMotion ? 'visible' : 'entering');
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = !!imageUrl && !imageFailed;
  const showLightning = !showImage && entry.icon === 'lightning';
  useLayoutEffect(() => startToastPlayback(entry.durationMs, reducedMotion, setPhase, () => complete(entry.id)), [entry, reducedMotion, complete]);
  return <div className="bis-toast bis-toast-with-image" data-message-type={entry.messageType} data-phase={phase} data-toast-id={entry.id} aria-hidden="true"
    style={{'--bis-toast-motion': `${TOAST_MOTION_MS}ms`} as CSSProperties}>
    <svg className="bis-toast-type-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {entry.messageType === 'info' && <><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/></>}
      {entry.messageType === 'warning' && <><path d="M12 3 22 21H2L12 3Z"/><path d="M12 9v5M12 18h.01"/></>}
      {entry.messageType === 'error' && <><circle cx="12" cy="12" r="9"/><path d="m6 18 12-12"/></>}
      {entry.messageType === 'success' && <path d="m4 12 5 5L20 6"/>}
    </svg>
    {showImage && <img className="bis-toast-image" src={imageUrl} alt="" width="48" height="48" referrerPolicy="no-referrer" onError={() => setImageFailed(true)} />}
    {showLightning && <span className="bis-bolt bis-toast-lightning" aria-hidden="true">⚡</span>}
    <span className="bis-toast-text">{entry.message}</span>
  </div>;
}

function PreparedToast({ entry, reducedMotion, complete, announce }: { entry: ToastEntry; reducedMotion: boolean; complete(id: number): void; announce(message: string): void }) {
  const [image, setImage] = useState<{ready: boolean; url?: string}>({ready: !entry.imageUrl});
  useEffect(() => {
    if (entry.imageUrl) return prepareToastImage(entry.imageUrl, url => setImage({ready: true, url}));
  }, [entry.imageUrl]);
  useEffect(() => {
    // An empty interval makes repeated identical notifications separate live-region updates.
    announce('');
    if (!image.ready) return;
    const timer = setTimeout(() => announce(`${entry.messageType}. ${entry.message}`), 0);
    return () => { clearTimeout(timer); announce(''); };
  }, [image.ready, entry.message, entry.messageType, announce]);
  return image.ready ? <ToastCard entry={entry} reducedMotion={reducedMotion} complete={complete} imageUrl={image.url} /> : null;
}

export function ToastViewport({ context }: { context: BisContext }) {
  const queue = getControls(context).toasts;
  const entry = useSyncExternalStore(queue.subscribe, queue.getSnapshot, queue.getSnapshot);
  const reducedMotion = useSyncExternalStore(subscribeReducedMotion, readReducedMotion, noReducedMotion);
  const [announcement, setAnnouncement] = useState('');
  useLayoutEffect(() => queue.attachPresentation(), [queue]);
  return <>
    <div className="bis-toast-viewport">
      {entry && <PreparedToast key={entry.id} entry={entry} reducedMotion={reducedMotion} complete={queue.complete} announce={setAnnouncement} />}
    </div>
    <div className="bis-sr-only bis-toast-announcement" role="status" aria-live="polite" aria-atomic="true">{announcement}</div>
  </>;
}
