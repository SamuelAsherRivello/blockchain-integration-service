import { ArkAddress } from '@arkade-os/sdk';
export function validContinueRecipient(value: unknown): value is string {
  if (typeof value !== 'string' || !value.trim()) return false;
  try { const address = ArkAddress.decode(value.trim()); return address.hrp === 'tark' && address.version === 0; }
  catch { return false; }
}
