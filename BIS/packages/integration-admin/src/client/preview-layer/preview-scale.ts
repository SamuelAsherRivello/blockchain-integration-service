const scaleStorageKey = 'bis.integration-demo.preview-scale';

export function readPreviewScale(storage?: Pick<Storage, 'getItem'>): number {
  try {
    const value = Number((storage ?? window.localStorage).getItem(scaleStorageKey));
    if (value === 1 || value === 0.5 || value === 0.25) return value;
  } catch { /* Storage may be unavailable; keep the default zoom. */ }
  return 0.5;
}

export function savePreviewScale(scale: number, storage?: Pick<Storage, 'setItem'>): void {
  try { (storage ?? window.localStorage).setItem(scaleStorageKey, String(scale)); }
  catch { /* Zoom still works without persistence. */ }
}
