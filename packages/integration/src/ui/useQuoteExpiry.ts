import { useEffect, useState } from 'react';

export function useQuoteExpiry(expiresAt?: number) {
  const [, refresh] = useState(0);
  useEffect(() => {
    if (expiresAt === undefined) return;
    const timer = setTimeout(() => refresh(value => value + 1), Math.max(0, expiresAt - Date.now()));
    return () => clearTimeout(timer);
  }, [expiresAt]);
  return expiresAt !== undefined && expiresAt <= Date.now();
}
