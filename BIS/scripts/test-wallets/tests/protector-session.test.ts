import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { windowsProtectorSession } from '../protector-session.ts';

const windows = process.platform === 'win32';
const fixtureRoot = fileURLToPath(new URL('../../../../output/test-temp/', import.meta.url));
const worker = fileURLToPath(new URL('../protector-worker.ps1', import.meta.url));
const publicBytes = Buffer.from('PUBLIC protector-session interoperability fixture. No wallet material.\n'.repeat(32));
type Protector = Pick<ReturnType<typeof windowsProtectorSession>, 'protect' | 'unprotect' | 'secure' | 'check'>;
const { windowsProtector } = await import(new URL('../protector.ts', import.meta.url).href) as {
  windowsProtector(options?: {executable?: string; timeout?: number}): Protector;
};
const generic = (error: unknown) => !!error && (error as {code?: string}).code === 'vault-protection-unavailable';
const alive = (pid: number | undefined) => { if (!pid) return false; try { process.kill(pid, 0); return true; } catch (error) { return (error as {code?: string}).code !== 'ESRCH'; } };

async function fixture(t: {after(callback: () => Promise<void>): void}) {
  await mkdir(fixtureRoot, { recursive: true });
  const directory = await mkdtemp(join(fixtureRoot, 'protector-session-'));
  t.after(async () => {
    assert.equal(dirname(resolve(directory)), resolve(fixtureRoot));
    assert.ok(directory.startsWith(join(fixtureRoot, 'protector-session-')));
    await rm(directory, { recursive: true, force: true });
  });
  return directory;
}

test('session uses one hidden process and interoperates with unchanged CurrentUser DPAPI helper', {skip:!windows,timeout:45000}, async t => {
  const directory = await fixture(t), session = windowsProtectorSession(), old = windowsProtector() as Protector;
  try {
    await session.secure(directory); const pid = session.pid;
    assert.ok(pid && alive(pid));
    const encrypted = await session.protect(publicBytes);
    const oldPlain = await old.unprotect(encrypted); assert.deepEqual(oldPlain, publicBytes); oldPlain.fill(0);
    const oldEncrypted = await old.protect(publicBytes);
    const plain = await session.unprotect(oldEncrypted); assert.deepEqual(plain, publicBytes); plain.fill(0);
    const concurrentInputs=[Buffer.from('PUBLIC concurrent fixture A'),Buffer.from('PUBLIC concurrent fixture B')];
    const concurrentEncrypted=await Promise.all(concurrentInputs.map(bytes=>session.protect(bytes)));
    const concurrentPlain=await Promise.all(concurrentEncrypted.map(bytes=>session.unprotect(bytes)));
    assert.deepEqual(concurrentPlain,concurrentInputs);
    for(const bytes of [...concurrentEncrypted,...concurrentPlain])bytes.fill(0);
    await session.check(directory); assert.equal(session.pid, pid);
    encrypted.fill(0); oldEncrypted.fill(0);
    await session.close(); assert.equal(alive(pid), false);
    await assert.rejects(session.check(directory), generic);
  } finally { await session.close(); }
});

test('every ACL check calls the original helper and refuses a later broad file ACL', {skip:!windows,timeout:45000}, async t => {
  const directory = await fixture(t), session = windowsProtectorSession();
  try {
    await session.secure(directory);
    const file = join(directory, 'public-fixture.txt'); await writeFile(file, publicBytes);
    await session.check(file); await session.check(file);
    const script = "$ErrorActionPreference='Stop'; $p=[Console]::In.ReadToEnd(); $acl=Get-Acl -LiteralPath $p; $sid=[System.Security.Principal.SecurityIdentifier]::new('S-1-1-0'); $rule=[System.Security.AccessControl.FileSystemAccessRule]::new($sid,'ReadData','Allow'); $acl.AddAccessRule($rule); Set-Acl -LiteralPath $p -AclObject $acl";
    const changed = spawnSync('pwsh', ['-NoLogo','-NoProfile','-NonInteractive','-Command',script], {input:file,encoding:'utf8',windowsHide:true,timeout:15000});
    assert.equal(changed.status, 0, 'public fixture ACL setup failed');
    const pid = session.pid;
    await assert.rejects(session.check(file), generic);
    await session.close(); assert.equal(alive(pid), false);
  } finally { await session.close(); }
});

test('helper security failure rejects the queued request and terminates the session', {skip:!windows,timeout:30000}, async t => {
  const directory = await fixture(t), session = windowsProtectorSession();
  try {
    await session.secure(directory); const pid = session.pid;
    const results = await Promise.allSettled([session.unprotect(Buffer.from('PUBLIC invalid DPAPI bytes')), session.check(directory)]);
    assert.ok(results.every(result => result.status === 'rejected' && generic(result.reason)));
    await session.close(); assert.equal(alive(pid), false);
  } finally { await session.close(); }
});

test('request deadline and explicit close terminate the child without leaving pending work', {skip:!windows,timeout:30000}, async t => {
  const timed = windowsProtectorSession({timeout:1});
  await assert.rejects(timed.protect(publicBytes), generic); const timedPid = timed.pid;
  await timed.close(); assert.equal(alive(timedPid), false);
  const directory = await fixture(t), session = windowsProtectorSession();
  try {
    await session.secure(directory); const pid = session.pid;
    const pending = session.protect(publicBytes); const rejected = assert.rejects(pending, generic);
    await session.close(); await rejected;
    assert.equal(alive(pid), false); assert.equal(session.closed, true);
    await assert.rejects(session.protect(publicBytes), generic);
  } finally { await session.close(); }
});

test('worker rejects malformed, repeated or unsafe request IDs with generic output only', {skip:!windows,timeout:45000}, () => {
  for (const input of ['{not-json}\n', JSON.stringify({id:9007199254740992,mode:'protect',target:null,data:'UFVCTElD'})+'\n']) {
    const result = spawnSync('pwsh', ['-NoLogo','-NoProfile','-NonInteractive','-File',worker], {input,encoding:'utf8',windowsHide:true,timeout:15000,maxBuffer:1024});
    assert.notEqual(result.status, 0); assert.equal(result.stdout, '');
    assert.match(result.stderr, /^(?:vault-protection-unavailable)+$/);
  }
  const line=JSON.stringify({id:1,mode:'protect',target:null,data:publicBytes.toString('base64')})+'\n';
  const repeated=spawnSync('pwsh',['-NoLogo','-NoProfile','-NonInteractive','-File',worker],{input:line+line,encoding:'utf8',windowsHide:true,timeout:15000,maxBuffer:16384});
  assert.notEqual(repeated.status,0);assert.equal(JSON.parse(repeated.stdout.trim()).id,1);
  assert.match(repeated.stderr,/^(?:vault-protection-unavailable)+$/);
});

test('oversized input fails before a process starts', () => {
  const session = windowsProtectorSession();
  return assert.rejects(session.protect(Buffer.alloc(4*1024*1024+1)), generic).then(async () => {
    assert.equal(session.pid, undefined); await session.close();
  });
});

test('unavailable executable fails generically and close remains safe', {skip:!windows,timeout:10000}, async t => {
  const directory=await fixture(t), session=windowsProtectorSession({executable:join(directory,'absent-public-test-program.exe')});
  await assert.rejects(session.protect(publicBytes),generic);
  await session.close();assert.equal(session.pid,undefined);assert.equal(session.closed,true);
});

test('large public payloads preserve exact bytes across fragmented response frames', {skip:!windows,timeout:30000}, async t => {
  const session=windowsProtectorSession(),publicLarge=Buffer.alloc(1500000,65);let encrypted:Buffer|undefined,plain:Buffer|undefined;
  try{
    const started=performance.now();encrypted=await session.protect(publicLarge);const protectedAt=performance.now();plain=await session.unprotect(encrypted);
    assert.ok(plain.equals(publicLarge));t.diagnostic(JSON.stringify({publicFixtureBytes:publicLarge.length,protectMs:Math.round(protectedAt-started),unprotectMs:Math.round(performance.now()-protectedAt)}));
  }finally{publicLarge.fill(0);encrypted?.fill(0);plain?.fill(0);await session.close();}
});

test('benchmark complete ACL/unprotect/protect/ACL cycles on public fixtures only', {skip:!windows,timeout:90000}, async t => {
  const directory = await fixture(t), old = windowsProtector() as Protector, session = windowsProtectorSession();
  await old.secure(directory);
  let cipher = await old.protect(publicBytes);
  const measure = async (protector: Protector) => {
    const durations: number[] = [];
    for (let index=0; index<3; index++) {
      const started=performance.now(); await protector.check(directory);
      const plain=await protector.unprotect(cipher); assert.deepEqual(plain,publicBytes);
      const next=await protector.protect(plain); plain.fill(0); cipher.fill(0); cipher=next;
      await protector.check(directory); durations.push(Math.round((performance.now()-started)*10)/10);
    }
    return durations;
  };
  try {
    const oneShot=await measure(old);
    const coldStart=performance.now(); await session.check(directory); const coldMs=Math.round((performance.now()-coldStart)*10)/10;
    const pid=session.pid, reused=await measure(session);
    assert.equal(session.pid,pid);
    await session.close(); assert.equal(alive(pid),false);
    t.diagnostic(JSON.stringify({fixtureBytes:publicBytes.length,cyclesPerMode:3,operationsPerCycle:4,oneShotMs:oneShot,sessionStartupMs:coldMs,reusedSessionMs:reused,workerProcesses:1,closed:true}));
  } finally { cipher.fill(0); await session.close(); }
});
