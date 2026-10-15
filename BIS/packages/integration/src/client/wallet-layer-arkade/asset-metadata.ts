import { normalizeAssetMetadata, type BisAssetMetadata } from '../state-layer-core/assets.ts';

/** Arkade metadata values are text/numbers/bytes; public BIS metadata stays typed. */
export function encodeAssetMetadata(metadata: BisAssetMetadata | undefined): Record<string, string | number> {
  const normalized = normalizeAssetMetadata(metadata);
  return Object.fromEntries(Object.entries(normalized ?? {}).map(([key, value]) => [
    key, typeof value === 'string' || typeof value === 'number' ? value : JSON.stringify(value),
  ]));
}
