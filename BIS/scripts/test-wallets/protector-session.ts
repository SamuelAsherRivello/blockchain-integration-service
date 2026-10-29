import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Match the existing explicit legacy bridge without weakening this module's types.
const { WalletToolError } = await import(new URL('./errors.ts', import.meta.url).href) as {
  WalletToolError: new (code: string) => Error & { code: string };
};

const worker = fileURLToPath(new URL('./protector-worker.ps1', import.meta.url));
const maximumData = 4 * 1024 * 1024;
const maximumFrame = maximumData + 4096;
const failure = () => new WalletToolError('vault-protection-unavailable');
type Mode = 'protect' | 'unprotect' | 'secure' | 'check';
type Pending = { id: number; mode: Mode; resolve(value: Buffer | undefined): void; reject(error: Error): void; timer: ReturnType<typeof setTimeout> };

/** One operation's protector. Always await close() in the operation's finally block. */
export function windowsProtectorSession({ executable = 'pwsh', timeout = 15000 } = {}) {
  if (!Number.isSafeInteger(timeout) || timeout < 1 || timeout > 60000 || typeof executable !== 'string' || !executable) throw failure();
  let child: ChildProcessWithoutNullStreams | undefined;
  let active: Pending | undefined;
  const frame = Buffer.alloc(maximumFrame);
  let frameLength = 0;
  let closed = false, exited = false, sequence = 0, queued = 0;
  let tail: Promise<unknown> = Promise.resolve();
  let exitResolve: (() => void) | undefined;
  let exitPromise = Promise.resolve();

  function clearFrame() { frame.fill(0, 0, frameLength); frameLength = 0; }
  function stop() {
    if (closed) return;
    closed = true;
    if (active) { clearTimeout(active.timer); active.reject(failure()); active = undefined; }
    clearFrame();
    if (child && !exited) {
      child.stdin.destroy(); child.stdout.destroy(); child.stderr.destroy();
      child.kill();
    }
  }
  function receive(data: Buffer) {
    if (!data.length) return;
    if (closed || !active || frameLength + data.length > maximumFrame) { data.fill(0); stop(); return; }
    const newline = data.indexOf(10);
    data.copy(frame, frameLength); frameLength += data.length;
    const finalLine = newline === data.length - 1;
    data.fill(0);
    if (newline < 0) return;
    if (!finalLine) { stop(); return; }
    let value: unknown;
    try {
      const response = JSON.parse(frame.subarray(0, frameLength - 1).toString('utf8'));
      if (!response || typeof response !== 'object' || Array.isArray(response) ||
          Object.keys(response).length !== 2 || !Object.hasOwn(response, 'id') || !Object.hasOwn(response, 'value') ||
          !Number.isSafeInteger(response.id) || response.id !== active.id || typeof response.value !== 'string') throw failure();
      if (active.mode === 'check' || active.mode === 'secure') {
        if (response.value !== 'ok') throw failure();
      } else {
        if (response.value.length > maximumData || !/^[A-Za-z0-9+/]+={0,2}$/.test(response.value)) throw failure();
        const bytes = Buffer.from(response.value, 'base64');
        if (bytes.toString('base64') !== response.value) { bytes.fill(0); throw failure(); }
        value = bytes;
      }
      const completed = active; active = undefined;
      clearTimeout(completed.timer); clearFrame();
      completed.resolve(value as Buffer | undefined);
    } catch { stop(); }
  }
  function start() {
    if (child) return;
    child = spawn(executable, ['-NoLogo', '-NoProfile', '-NonInteractive', '-File', worker], {
      windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'],
    });
    exitPromise = new Promise<void>(resolve => { exitResolve = resolve; });
    child.once('close', () => { exited = true; stop(); exitResolve?.(); });
    child.once('error', () => { stop(); if (!child?.pid) { exited = true; exitResolve?.(); } });
    child.stdin.on('error', stop); child.stdout.on('error', stop); child.stderr.on('error', stop);
    child.stdout.on('data', receive);
    // Never collect or forward helper diagnostics, invocation lines or input.
    child.stderr.resume();
  }
  function invoke(mode: Mode, target?: string, bytes?: Buffer): Promise<Buffer | undefined> {
    if (closed || process.platform !== 'win32' || queued >= 16 || sequence >= Number.MAX_SAFE_INTEGER ||
        (target !== undefined && (typeof target !== 'string' || !target || target.length > 32767 || target.includes('\0'))) ||
        (bytes !== undefined && (!Buffer.isBuffer(bytes) || bytes.length > maximumData))) {
      stop(); return Promise.reject(failure());
    }
    const input = bytes === undefined ? undefined : Buffer.from(bytes);
    const id = ++sequence; queued++;
    const result = tail.then(() => {
      if (closed) throw failure();
      const request = Buffer.from(JSON.stringify({ id, mode, target: target ?? null, data: input?.toString('base64') ?? null }) + '\n', 'utf8');
      if (request.length > maximumFrame) { request.fill(0); stop(); throw failure(); }
      return new Promise<Buffer | undefined>((resolve, reject) => {
        const timer = setTimeout(stop, timeout);
        active = { id, mode, resolve, reject, timer };
        try {
          start();
          child!.stdin.write(request, error => { request.fill(0); if (error) stop(); });
        } catch { request.fill(0); stop(); }
      });
    }).finally(() => { input?.fill(0); queued--; });
    tail = result.catch(() => {});
    return result;
  }
  async function close() {
    stop();
    if (!child || exited) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([exitPromise, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(failure()), 2000); })]);
    } finally { if (timer) clearTimeout(timer); }
  }
  return Object.freeze({
    protect: (bytes: Buffer) => invoke('protect', undefined, bytes) as Promise<Buffer>,
    unprotect: (bytes: Buffer) => invoke('unprotect', undefined, bytes) as Promise<Buffer>,
    secure: (path: string) => invoke('secure', path) as Promise<void>,
    check: (path: string) => invoke('check', path) as Promise<void>,
    close,
    get pid() { return child?.pid; },
    get closed() { return closed; },
  });
}
