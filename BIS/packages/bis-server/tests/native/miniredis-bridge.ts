import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createInterface } from 'node:readline';
import type { TestContext } from 'node:test';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const endpoint = 'https://bis-server-miniredis.test';
const token = 'bis-server-native-test-transport-token';
const startupTimeoutMs = 120_000;
const commandTimeoutMs = 10_000;
const goBinary = process.env.BIS_GO_BINARY ?? 'go';

export async function startMiniredisBridge(t: TestContext) {
  const nativeDir = fileURLToPath(new URL('.', import.meta.url));
  const root = resolve(nativeDir, '../../../../..');
  const cache = resolve(root, 'output/tool-cache/bis-server-native-tests');
  const child: ChildProcessWithoutNullStreams = spawn(goBinary, ['run', '.'], {
    cwd: nativeDir,
    env: {
      ...process.env,
      GOPATH: resolve(cache, 'gopath'),
      GOMODCACHE: resolve(cache, 'gomodcache'),
      GOCACHE: resolve(cache, 'gocache'),
      GOWORK: 'off',
      GOTOOLCHAIN: 'auto',
      GOFLAGS: '-mod=readonly',
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  let stderr = '';
  let closedError: Error | undefined;
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', chunk => { stderr = `${stderr}${chunk}`.slice(-4000); });
  const lines = createInterface({ input: child.stdout, crlfDelay: Infinity });
  const queued: string[] = [];
  const waiters: Array<{resolve:(line:string)=>void;reject:(error:Error)=>void}> = [];
  child.once('error', error => { closedError = error; for (const waiter of waiters.splice(0)) waiter.reject(error); });
  child.once('close', (code, signal) => {
    closedError ??= new Error(`bridge exited (${code ?? signal}): ${stderr}`);
    for (const waiter of waiters.splice(0)) waiter.reject(closedError);
  });
  void (async () => {
    for await (const line of lines) {
      const waiter = waiters.shift();
      if (waiter) waiter.resolve(line);
      else queued.push(line);
    }
  })();
  const nextLine = (timeoutMs: number, stage: string) => {
    if (queued.length) return Promise.resolve(queued.shift()!);
    if (closedError) return Promise.reject(closedError);
    return new Promise<string>((resolveLine, reject) => {
      const waiter = {resolve:(line:string)=>{clearTimeout(timer);resolveLine(line);},reject:(error:Error)=>{clearTimeout(timer);reject(error);}};
      const timer=setTimeout(()=>{
        const index=waiters.indexOf(waiter);if(index>=0)waiters.splice(index,1);
        const error=new Error(`Timed out waiting ${timeoutMs}ms for miniredis bridge ${stage}; stderr: ${stderr}`);
        if(stage==='command response'){stopped=true;closedError=error;child.kill();for(const pending of waiters.splice(0))pending.reject(error);}
        reject(error);
      },timeoutMs);
      waiters.push(waiter);
    });
  };
  let stopped = false, cleanedUp = false;
  t.after(async () => {
    if (cleanedUp) return;
    cleanedUp = true;
    stopped = true;
    if (child.exitCode === null && child.signalCode === null) {
      if(!closedError)try { child.stdin.write('{"shutdown":true}\n'); child.stdin.end(); } catch { /* the test child may already be exiting */ }
      await Promise.race([
        new Promise<void>(resolveExit => child.once('close', () => resolveExit())),
        new Promise<void>(resolveTimeout => setTimeout(() => { child.kill(); resolveTimeout(); }, 5000)),
      ]);
    }
    lines.close();
  });
  const readyLine = await nextLine(startupTimeoutMs, 'startup');
  if (JSON.parse(readyLine).ready !== true) throw new Error(`Miniredis bridge did not become ready: ${readyLine} ${stderr}`);

  let tail: Promise<unknown> = Promise.resolve();
  const transport = t.mock.method(globalThis, 'fetch', async (url: Parameters<typeof fetch>[0], init?: RequestInit) => {
    if(stopped||closedError)throw closedError??new Error('Miniredis bridge is stopped.');
    assertEndpoint(url, init);
    const command: unknown = JSON.parse(String(init?.body));
    const pipeline = String(url).endsWith('/pipeline');
    const commands = pipeline && Array.isArray(command) && Array.isArray(command[0]) ? command as unknown[][] : [command as unknown[]];
    if (!Array.isArray(command) || commands.some(item => !Array.isArray(item) || item.length === 0 || item.some(value => typeof value !== 'string' && typeof value !== 'number'))) {
      return Response.json({ error: 'invalid command' }, { status: 400 });
    }
    const run = tail.then(async () => {
      const results = [];
      for (const item of commands) {
        child.stdin.write(`${JSON.stringify(item)}\n`);
        const line = await nextLine(commandTimeoutMs, 'command response');
        results.push(JSON.parse(line) as { result?: unknown; error?: string });
      }
      if (pipeline) return Response.json(results.map(result => ({ result: encodeRestStrings(result.result), error: result.error ?? null })));
      const result = results[0];
      return result.error ? Response.json({ error: result.error }, { status: 400 }) : Response.json({ result: encodeRestStrings(result.result) });
    });
    tail = run.catch(() => undefined);
    return run;
  });
  return { endpoint, token, transport };
}

function encodeRestStrings(value: unknown): unknown {
  if (typeof value === 'string') return Buffer.from(value, 'utf8').toString('base64');
  if (Array.isArray(value)) return value.map(encodeRestStrings);
  return value;
}

function assertEndpoint(url: Parameters<typeof fetch>[0], init?: RequestInit) {
  if (![endpoint, `${endpoint}/pipeline`].includes(String(url)) || init?.method !== 'POST')
    throw new Error(`Unexpected Redis REST request: ${String(url)} ${init?.method} ${init?.cache}.`);
  const headers = new Headers(init.headers);
  if (headers.get('authorization') !== `Bearer ${token}` || headers.get('upstash-encoding') !== 'base64') throw new Error('Unexpected Redis REST credentials/encoding.');
}
