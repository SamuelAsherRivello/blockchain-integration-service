const splitStorageKey = 'bis.integration-demo.admin-split-percent';

export function readSplitPercent(storage?: Pick<Storage, 'getItem'>): number {
  try {
    const value = Number((storage ?? globalThis.localStorage)?.getItem(splitStorageKey));
    if (Number.isFinite(value) && value > 0 && value < 100) return value;
  } catch { /* Storage may be blocked; keep the divider usable. */ }
  return 32;
}

export function saveSplitPercent(percent: number, storage?: Pick<Storage, 'setItem'>): void {
  try { (storage ?? globalThis.localStorage)?.setItem(splitStorageKey, String(percent)); }
  catch { /* Resizing still works without persistence. */ }
}

export function splitPercent(position: number, width: number): number {
  if (width <= 0) return 32;
  const available = Math.max(0, width - 10);
  const compact = width <= 700;
  const previewMinimum = compact ? Math.min(180, available * 0.3) : Math.min(260, available / 2);
  const adminMinimum = Math.min(380, Math.max(0, available - previewMinimum));
  const minimum = Math.min(adminMinimum, Math.max(0, available - previewMinimum));
  const maximum = Math.max(minimum, available - previewMinimum);
  return Math.max(minimum, Math.min(position, maximum)) / width * 100;
}
