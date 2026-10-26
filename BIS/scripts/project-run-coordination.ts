import { mkdir, readFile, writeFile, rename, unlink, rmdir, realpath } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const alive = pid => { try { process.kill(pid, 0); return true; } catch { return false; } };
const json = async path => { try { return JSON.parse(await readFile(path, 'utf8')); } catch { return null; } };
const normalize = path => process.platform === 'win32' ? resolve(path).toLowerCase() : resolve(path);

// Protocol shared with the installed PowerShell run helper. Never steal a lock:
// after a crash, report its owner and require explicit, inspected recovery.
export async function acquireStartupLock(directory, timeoutMs = 25000) {
  await mkdir(directory, { recursive: true });
  const lock = join(directory, 'startup.lock');
  const ownerPath = join(lock, 'owner.json');
  const inherited = process.env.PROJECT_RUN_LOCK_TOKEN;
  const owner = await json(ownerPath);
  if (inherited && owner?.token === inherited && alive(owner.pid)) return async () => {};
  const token = randomUUID();
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      await mkdir(lock);
      try { await writeFile(ownerPath, JSON.stringify({ pid: process.pid, token }), { flag: 'wx' }); }
      catch (error) { await rmdir(lock).catch(() => {}); throw error; }
      return async () => {
        if ((await json(ownerPath))?.token !== token) throw Error('Startup lock ownership changed; preserving it.');
        await unlink(ownerPath);
        await rmdir(lock);
      };
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      if (Date.now() >= deadline) {
        const current = await json(ownerPath);
        throw Error('Startup lock busy or stale. Owner PID ' + (current?.pid ?? 'unknown') + '. No server was stopped.');
      }
      await delay(100);
    }
  }
}

function legacyLauncherMatches(record) {
  if (!Number.isInteger(record.launcherPid) || !alive(record.launcherPid)) return false;
  const rootLiteral = record.projectRoot.replaceAll("'", "''");
  const script = "$ProgressPreference='SilentlyContinue'; $p=Get-CimInstance Win32_Process -Filter 'ProcessId=" + record.launcherPid + "'; " +
    "if ($p.CommandLine -and $p.CommandLine.IndexOf('" + rootLiteral + "',[StringComparison]::OrdinalIgnoreCase) -ge 0 " +
    "-and $p.CommandLine -match '(npm|vite|project-run|dev-all)') { 'owned' }";
  return execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand',
    Buffer.from(script, 'utf16le').toString('base64')], { encoding: 'utf8', timeout: 5000 }).trim() === 'owned';
}

function legacyListenerMatches(record, port) {
  if (process.platform !== 'win32' || !record?.listenerPids?.length) return false;
  try {
    const lines = execFileSync('netstat.exe', ['-ano', '-p', 'tcp'], { encoding: 'utf8', timeout: 5000 });
    return lines.split(/\r?\n/).some(line => {
      const fields = line.trim().split(/\s+/);
      return fields[0] === 'TCP' && fields[1] === '127.0.0.1:' + port &&
        fields[3] === 'LISTENING' && record.listenerPids.includes(Number(fields[4]));
    }) && legacyLauncherMatches(record);
  } catch { return false; }
}

async function health(port, routes) {
  for (const route of routes) {
    try {
      const response = await fetch('http://127.0.0.1:' + port + route.route, { signal: AbortSignal.timeout(2000) });
      const html = await response.text();
      const title = html.match(/<title[^>]*>\s*([^<]+?)\s*<\/title>/i)?.[1]
        .replaceAll('&amp;', '&').trim();
      if (!response.ok || title !== (route.title ?? route.label)) return false;
    } catch { return false; }
  }
  return true;
}

export async function coordinateProject({ root, port, canonicalPort, routes, isolated = false, start, timeoutMs = 25000 }) {
  root = await realpath(root);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw Error('Invalid development port.');
  if (isolated && [canonicalPort, 5174, 5176, 5190].includes(port)) throw Error('Isolated tests cannot use a reserved shared service port.');
  if (!isolated && port !== canonicalPort) throw Error('Shared development port is fixed at ' + canonicalPort + '. Use --isolated for an explicit test server.');
  const directory = join(root, 'output', 'run-state', ...(isolated ? ['isolated-' + port] : []));
  const statePath = join(directory, 'project-run.json');
  const projectKey = createHash('sha256').update(normalize(root)).digest('hex');
  const release = await acquireStartupLock(directory, timeoutMs);
  let server;
  try {
    const record = await json(statePath);
    let identity;
    try {
      const response = await fetch('http://127.0.0.1:' + port + '/__project_run_identity', { signal: AbortSignal.timeout(700) });
      if (response.ok) identity = await response.json();
    } catch {}
    const sameRecord = record && normalize(record.projectRoot) === normalize(root) && record.port === port;
    const owned = identity?.projectKey === projectKey && alive(identity.pid) ||
      sameRecord && legacyListenerMatches(record, port);
    if (owned) {
      if (!await health(port, routes)) throw Error('Existing project server is unhealthy. Preserved; an explicit restart is required.');
      console.log('Reusing project server at http://127.0.0.1:' + port);
      return { reused: true, port };
    }
    // Binding remains strict even when inspection cannot identify an occupied port.
    const instanceId = randomUUID();
    const marker = { projectKey, instanceId, pid: process.pid, port };
    server = await start(marker);
    const address = server.httpServer?.address();
    if (!address || address.port !== port) throw Error('Development server did not bind its assigned port.');
    const deadline = Date.now() + timeoutMs;
    while (!await health(port, routes)) {
      if (Date.now() >= deadline) throw Error('Development routes did not become healthy; only this new server will be closed.');
      await delay(100);
    }
    const next = {
      schema: 3, projectRoot: root, port, portRange: { min: port, max: port },
      serverMode: routes.length === 1 ? 'single' : 'shared', instanceId,
      launcherPid: process.pid, listenerPids: [process.pid], startedAt: new Date().toISOString(),
      routes: routes.map(route => ({ ...route, url: 'http://127.0.0.1:' + port + route.route })),
    };
    const temp = statePath + '.' + instanceId + '.tmp';
    await writeFile(temp, JSON.stringify(next, null, 2));
    await rename(temp, statePath);
    return { reused: false, server, port };
  } catch (error) {
    await server?.close();
    throw error;
  } finally { await release(); }
}

export function identityMiddleware(identity) {
  return (request, response, next) => {
    if (request.url?.split('?')[0] !== '/__project_run_identity') return next();
    response.setHeader('Content-Type', 'application/json');
    response.setHeader('Cache-Control', 'no-store');
    response.end(JSON.stringify(identity));
  };
}
