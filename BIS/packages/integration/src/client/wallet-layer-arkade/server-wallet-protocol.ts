import { Transaction, TxTree } from '@arkade-os/sdk';

// PartialSig is declaration-only in SDK 0.4.79. Preserve its public structural contract.
class WirePartialSignature {
  s: Uint8Array; R: Uint8Array;
  constructor(s: Uint8Array, R: Uint8Array) { if(s.length!==32||R.length!==33)throw Error('Invalid partial signature encoding.'); this.s = s; this.R = R; }
  encode() { return new Uint8Array(this.s); }
}

export const SIGNER_PROTOCOL = 1;
export const toHex = (value: Uint8Array): string => Array.from(value, b => b.toString(16).padStart(2, '0')).join('');
export function fromHex(value: string): Uint8Array {
  if (typeof value !== 'string' || value.length % 2 || !/^[0-9a-f]*$/i.test(value)) throw Error('Invalid signer encoding.');
  return Uint8Array.from(value.match(/../g) ?? [], byte => parseInt(byte, 16));
}

/** Only explicitly supported protocol values cross the signing boundary. */
export function encodeSigningValue(value: unknown): unknown {
  if (value instanceof Uint8Array) return { $type: 'bytes', value: toHex(value) };
  if (typeof value === 'bigint') return { $type: 'bigint', value: value.toString() };
  if (value instanceof Transaction) return { $type: 'transaction', value: toHex(value.toPSBT()) };
  if (value && typeof value === 'object' && 'toPSBT' in value && typeof value.toPSBT === 'function') return { $type: 'transaction', value: toHex(value.toPSBT()) };
  if (value instanceof TxTree) return { $type: 'tree', root: encodeSigningValue(value.root), children: encodeSigningValue(value.children) };
  if (value && typeof value === 'object' && 's' in value && 'R' in value && value.s instanceof Uint8Array && value.R instanceof Uint8Array && 'encode' in value && typeof value.encode === 'function') return { $type: 'partial', s: toHex(value.s), R: toHex(value.R) };
  if (value instanceof Map) return { $type: 'map', value: [...value].map(([key, item]) => [encodeSigningValue(key), encodeSigningValue(item)]) };
  if (Array.isArray(value)) return value.map(encodeSigningValue);
  if (value && typeof value === 'object') {
    if ('secNonce' in value) throw Error('Secret signing nonces cannot cross the transport.');
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, encodeSigningValue(item)]));
  }
  if (value === undefined) return null;
  if (value === null || typeof value === 'string' || typeof value === 'boolean' || (typeof value === 'number' && Number.isSafeInteger(value))) return value;
  throw Error('Unsupported signer value.');
}
export function decodeSigningValue(value: unknown, depth = 0): any {
  if (depth > 64) throw Error('Signer payload too deep.');
  if (Array.isArray(value)) return value.map(item => decodeSigningValue(item, depth + 1));
  if (!value || typeof value !== 'object') return value;
  const row = value as Record<string, any>;
  switch (row.$type) {
    case 'bytes': return fromHex(row.value);
    case 'bigint': if (!/^-?\d{1,30}$/.test(row.value)) throw Error('Invalid integer.'); return BigInt(row.value);
    case 'transaction': return Transaction.fromPSBT(fromHex(row.value));
    case 'tree': return new TxTree(decodeSigningValue(row.root, depth + 1), decodeSigningValue(row.children, depth + 1));
    case 'partial': return new WirePartialSignature(fromHex(row.s), fromHex(row.R));
    case 'map': return new Map(row.value.map(([key, item]: unknown[]) => [decodeSigningValue(key, depth + 1), decodeSigningValue(item, depth + 1)]));
    case undefined: return Object.fromEntries(Object.entries(row).map(([key, item]) => [key, decodeSigningValue(item, depth + 1)]));
    default: throw Error('Unsupported signer type.');
  }
}
