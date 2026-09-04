const splitStorageKey = 'bis.integration-demo.admin-split-percent';

export function readSplitPercent(storage?: Pick<Storage, 'getItem'>): number {
  try {
    const value = Number(storage?.getItem(splitStorageKey));
    if (Number.isFinite(value) && value > 0 && value < 100) return value;
  } catch { /* Storage may be blocked; keep the divider usable. */ }
  return 32;
}

export function saveSplitPercent(percent: number, storage?: Pick<Storage, 'setItem'>): void {
  try { storage?.setItem(splitStorageKey, String(percent)); }
  catch { /* Resizing still works without persistence. */ }
}

export function splitPercent(position: number, width: number): number {
  if (width <= 0) return 32;
  const previewMinimum = Math.min(260, (width - 10) / 2);
  const adminMinimum = Math.min(340, width - previewMinimum - 10);
  return Math.max(adminMinimum, Math.min(position, width - previewMinimum - 10)) / width * 100;
}
