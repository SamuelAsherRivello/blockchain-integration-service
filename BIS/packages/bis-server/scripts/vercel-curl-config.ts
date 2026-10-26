const quote = (value: string) => '"' + value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r/g, '\\r').replace(/\n/g, '\\n') + '"';

/** Private request configuration is passed through stdin, never process args.
 * Header names are case-insensitive; a refreshed grant replaces the old one.
 */
export function vercelCurlConfig(body?: unknown, headers: Record<string, string> = {}) {
  const normalized = new Map<string, string>([['content-type', 'application/json']]);
  for (const [name, value] of Object.entries(headers)) {
    if (!/^[a-zA-Z0-9-]+$/.test(name)) throw Error('Invalid acceptance request header.');
    normalized.set(name.toLowerCase(), value);
  }
  return [`request = ${quote(body === undefined ? 'GET' : 'POST')}`, ...[...normalized].map(([name, value]) => `header = ${quote(name + ': ' + value)}`), ...(body === undefined ? [] : [`data-raw = ${quote(JSON.stringify(body))}`]), 'silent', 'show-error', 'max-time = 35'].join('\n');
}
