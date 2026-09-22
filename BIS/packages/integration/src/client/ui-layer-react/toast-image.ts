export const TOAST_IMAGE_WAIT_MS = 3000;
type ImageLoader = Pick<HTMLImageElement, 'src' | 'referrerPolicy' | 'onload' | 'onerror' | 'decode'>;
type Schedule = (callback: () => void, delay: number) => () => void;
const scheduleTimeout: Schedule = (callback, delay) => {
  const timer = setTimeout(callback, delay);
  return () => clearTimeout(timer);
};

/** Prepare optional artwork before the toast's lifetime starts; failure never blocks text. */
export function prepareToastImage(source: string, ready: (source?: string) => void, createImage: () => ImageLoader = () => new Image(), schedule: Schedule = scheduleTimeout) {
  const image = createImage();
  let stopped = false;
  const cancelDeadline = schedule(() => finish(), TOAST_IMAGE_WAIT_MS);
  function cancel() { stopped = true; cancelDeadline(); image.onload = null; image.onerror = null; }
  function finish(value?: string) { if (!stopped) { cancel(); ready(value); } }
  image.referrerPolicy = 'no-referrer';
  image.onload = async () => {
    try { await image.decode(); finish(source); }
    catch { finish(); }
  };
  image.onerror = () => finish();
  image.src = source;
  return cancel;
}
