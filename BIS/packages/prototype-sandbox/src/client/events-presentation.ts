export const EVENT_DISPLAY_MS = 5000;
export const EVENT_PULSE = {
  keyframes: [{ transform: 'scale(1)' }, { transform: 'scale(1.2)', offset: 0.5 }, { transform: 'scale(1)' }],
  options: { duration: 1000, iterations: 3, easing: 'ease-in-out' },
};

export function presentActivity(card: Pick<HTMLElement, 'animate'>, reset: () => void, reducedMotion: boolean) {
  const animation = reducedMotion ? undefined : card.animate(EVENT_PULSE.keyframes, EVENT_PULSE.options);
  const timer = setTimeout(reset, EVENT_DISPLAY_MS);
  return () => { clearTimeout(timer); animation?.cancel(); };
}
