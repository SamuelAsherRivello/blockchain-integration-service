export type ToastPhase = 'entering' | 'visible' | 'exiting';
export const TOAST_MOTION_MS = 200;
type Schedule = (callback: () => void, delay: number) => () => void;
const scheduleTimeout: Schedule = (callback, delay) => {
  const timer = setTimeout(callback, delay);
  return () => clearTimeout(timer);
};

/** One cancellable lifecycle; the hold never includes either motion interval. */
export function startToastPlayback(durationMs: number, reducedMotion: boolean, onPhase: (phase: ToastPhase) => void, onDone: () => void, schedule: Schedule = scheduleTimeout) {
  let stopped = false, cancelTimer: (() => void) | undefined;
  const later = (callback: () => void, delay: number) => {
    cancelTimer = schedule(() => { if (!stopped) callback(); }, delay);
  };
  function finish() { if (!stopped) { stopped = true; onDone(); } }
  function exit() {
    if (reducedMotion) { finish(); return; }
    onPhase('exiting'); later(finish, TOAST_MOTION_MS);
  }
  function hold() { onPhase('visible'); later(exit, durationMs); }
  if (reducedMotion) hold();
  else { onPhase('entering'); later(hold, TOAST_MOTION_MS); }
  return () => { stopped = true; cancelTimer?.(); };
}
