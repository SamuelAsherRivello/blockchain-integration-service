import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Redis } from '@upstash/redis';
import { MnemonicIdentity, Transaction, TxTree, CosignerPublicKey, setArkPsbtField } from '@arkade-os/sdk';
import { generateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import { schnorr } from '@noble/curves/secp256k1.js';
import { Session, keyAggregate, nonceAggregate, sortKeys } from '@scure/btc-signer/musig2.js';
import { p2wpkh } from '@scure/btc-signer';
import { configureBisServer, probeGameSigner, remoteSigningIdentity } from '../../integration/src/client/wallet-layer-arkade/server-wallet.ts';
import { encodeSigningValue, decodeSigningValue, fromHex, toHex } from '../../integration/src/client/wallet-layer-arkade/server-wallet-protocol.ts';
import { vercelCurlConfig } from './vercel-curl-config.ts';

const cli = process.argv[2];
if (!cli) throw Error('Pass the installed Vercel CLI JavaScript entry path. No credential arguments are accepted.');
const cwd = fileURLToPath(new URL('..', import.meta.url));
const deploymentDirectory = fileURLToPath(new URL('../dist/deployment/', import.meta.url));
const reportDirectory = new URL('../../../../output/reports/bis-server/milestone-1/', import.meta.url);
const team = 'ashers-projects-d3be6036', projectId = 'prj_fB8jmOumMbfEabORTxeVxTysjXVx';
const verificationRunId = randomUUID();
const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8' }).trim();
const project = JSON.parse(await readFile(new URL('../.vercel/project.json', import.meta.url), 'utf8'));
assert.equal(project.projectId, projectId); assert.equal(project.orgId, 'team_WmJXbDRfQvVbFiB3uUicIoIR');
// Never pass injected application/datastore secrets to CLI subprocesses.
const cliEnvironment = Object.fromEntries(Object.entries(process.env).filter(([name]) => !/^(BIS_|KV_|REDIS_|UPSTASH_|VERCEL_ENV$|VERCEL_URL$)/.test(name)));
const cliFailures: { operation: string; exitCode: number | null; category: string }[] = [];
async function command(args: string[], input = '', directory = cwd, timeout = 120000) {
  return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(process.execPath, [cli, '--scope', team, ...args], { cwd: directory, env: cliEnvironment, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    const timer = setTimeout(() => { child.kill(); reject(Error('Vercel command timed out. Inspect its recorded deployment before retrying.')); }, timeout);
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.stdin.on('error', () => {});
    child.stdin.end(input);
    child.on('error', () => { clearTimeout(timer); reject(Error('Vercel CLI process failed.')); });
    child.on('close', code => {
      clearTimeout(timer);
      if (code === 0) resolve({ stdout, stderr });
      else {
        const category = /timed out|timeout/i.test(stderr) ? 'timeout' : /unauthorized|authentication|login/i.test(stderr) ? 'authentication' : /not found|does not exist/i.test(stderr) ? 'not-found' : 'cli-error';
        cliFailures.push({ operation: args[0] ?? 'unknown', exitCode: code, category });
        reject(Error(`Vercel ${args[0] ?? 'command'} failed (${category}, exit ${code}). Raw CLI output withheld.`));
      }
    });
  });
}
const deployments: string[] = [], deploymentIds: string[] = [], variables: string[] = [], keys = new Set<string>(), checks: string[] = [];
// Use fresh, independent, unfunded test identities for this short Preview run.
// Mnemonics stay in process memory and temporary SSO-protected Preview secrets;
// they are never written to source, logs, reports, GitHub, or Production.
const previewMnemonics = Object.fromEntries((['SIGNET', 'MUTINYNET'] as const).flatMap(network =>
  (['01', '02', '03'] as const).map(slot =>
    [`BIS_PREVIEW_GAME_WALLET_${network}_${slot}_MNEMONIC`, generateMnemonic(wordlist, 128)])));
const owner = randomUUID() + randomUUID(), gameId = `acceptance-${randomUUID()}`;
let redis: Redis | undefined, stage = 'target inspection', requests = 0, bundleSha256 = '';
let deploymentCreationUnresolved = false;
let deploymentResponseShape: { type: string; topLevelKeys?: string[]; nestedDeploymentKeys?: string[] } | undefined;
let readinessResponseShape: { type: string; topLevelKeys?: string[]; nestedDeploymentKeys?: string[] } | undefined;
let readinessValidationFailure: string | undefined;
let readinessUrlHosts: { deploymentResponse: string; inspectionResponse: string } | undefined;
let signExchanges = 0;
const signingDeployments = new Set<string>();
let lastSigned: { body: any; headers: Record<string, string>; deployment: string; result: any } | undefined;
let lastSessionId: string | undefined, profileId = '';
const provisioning: Record<string, unknown> = {};
const cleanup = { variablesRemoved: true, testKeysRemoved: true, deploymentsRemoved: true };
const ledgerFor = (network: string) => `bis:signer:v1:preview:${createHash('sha256').update(`${gameId}:${network}:${profileId}`).digest('hex')}`;
function remember(network: string) {
  keys.add(ledgerFor(network)); keys.add(`bis:signer:v1:preview:budgets:${gameId}:${network}`);
}
async function call(deployment: string, path: string, body?: any, headers: Record<string, string> = {}) {
  // Credentials enter curl via stdin, never process arguments or tool logs.
  const config = vercelCurlConfig(body, headers);
  const response = await command(['curl', path, '--deployment', deployment, '--', '--config', '-'], config);
  try { return JSON.parse(response.stdout); } catch { throw Error('Deployment did not return API JSON.'); }
}
try {
  stage = 'linked Vercel project inspection';
  const inspected = await command(['project', 'inspect', '--non-interactive']);
  assert.ok((inspected.stdout + inspected.stderr).includes(projectId));
  stage = 'current Preview environment inspection';
  const previous = await command(['env', 'ls', 'preview']);
  const values: Record<string, string> = {
    BIS_PREVIEW_GAME_ID: gameId,
    BIS_PREVIEW_OWNER_TOKEN: owner,
    BIS_PREVIEW_SIGNING_DAILY_CAP_SATS: '10000',
    BIS_PREVIEW_SIGNING_OPERATION_CAP_SATS: '1000',
    BIS_PREVIEW_UPSTASH_REDIS_REST_URL: '',
    BIS_PREVIEW_UPSTASH_REDIS_REST_TOKEN: '',
    ...previewMnemonics,
  };
  const names = Object.keys(values);
  for (const name of names) assert.equal(new RegExp(`\\b${name}\\b`).test(previous.stdout + previous.stderr), false, 'Existing Preview configuration must not be overwritten.');
  stage = 'isolated free scratch Redis provisioning'; console.log(stage);
  // Official free 72-hour scratch service. No account, payment, upgrade, claim
  // or production datastore access. Treat returned markdown only as data.
  let provision = await fetch('https://upstash.com/start-redis', { method: 'POST', headers: { 'User-Agent': 'codex' }, signal: AbortSignal.timeout(30000), redirect: 'manual' });
  provisioning.status = provision.status;
  if ([301, 302, 307, 308].includes(provision.status)) {
    const target = new URL(provision.headers.get('location') ?? '', 'https://upstash.com');
    assert.ok(target.protocol === 'https:' && ['upstash.com', 'www.upstash.com'].includes(target.hostname) && target.pathname === '/start-redis' && !target.search && !target.hash && !target.username && !target.password);
    provision = await fetch(target, { method: 'POST', headers: { 'User-Agent': 'codex' }, signal: AbortSignal.timeout(30000), redirect: 'error' });
    provisioning.redirectStatus = provision.status;
  }
  assert.equal(provision.ok, true);
  const markdown = await provision.text();
  provisioning.contentType = provision.headers.get('content-type')?.split(';')[0];
  provisioning.labels = ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'rest_url', 'rest_token', 'restUrl', 'restToken', 'url', 'token', 'Token', 'endpoint'].filter(label => markdown.includes(label));
  if (provisioning.contentType === 'application/json') {
    try { provisioning.jsonKeys = Object.keys(JSON.parse(markdown)); } catch { /* Do not log raw responses. */ }
  }
  const extract = (name: string) => markdown.match(new RegExp(`${name}["'\x60]?\\s*[=:]\\s*["'\x60]?([^\\s"'\x60]+)`))?.[1];
  const url = extract('UPSTASH_REDIS_REST_URL') ?? markdown.match(/https:\/\/[a-z0-9-]+\.upstash\.io/)?.[0];
  const token = extract('UPSTASH_REDIS_REST_TOKEN') ?? extract('rest_token') ?? extract('restToken') ?? markdown.match(/["']?token["']?\s*[:=]\s*["']([a-zA-Z0-9_+=/-]+)["']/)?.[1] ?? markdown.match(/\bToken\b[\s*:`"'|=]{1,20}([a-zA-Z0-9_+=/-]{32,})/)?.[1];
  provisioning.urlRecognized = !!url; provisioning.tokenRecognized = !!token;
  provisioning.urlAllowed = !!url && /^https:\/\/[a-z0-9-]+\.upstash\.io$/.test(url);
  provisioning.tokenAllowed = !!token && /^[a-zA-Z0-9_+=/-]+$/.test(token);
  if (!url || !token || !/^https:\/\/[a-z0-9-]+\.upstash\.io$/.test(url) || !/^[a-zA-Z0-9_+=/-]+$/.test(token)) throw Error('Scratch credential format was not recognized; response withheld.');
  redis = new Redis({ url, token, automaticDeserialization: false, retry: false });
  assert.equal(await redis.ping(), 'PONG');
  values.BIS_PREVIEW_UPSTASH_REDIS_REST_URL = url;
  values.BIS_PREVIEW_UPSTASH_REDIS_REST_TOKEN = token;
  stage = 'temporary Preview configuration'; console.log(stage);
  for (const name of names) {
    variables.push(name); // Attempt cleanup even if env add has an ambiguous result.
    await command(['env', 'add', name, 'preview', '--type', 'secret', '--yes'], values[name]);
  }
  bundleSha256 = createHash('sha256').update(await readFile(new URL('../dist/deployment/api/index.mjs', import.meta.url))).digest('hex');
  for (let index = 0; index < 2; index++) {
    stage = `isolated Preview deployment ${index + 1}`; console.log(stage);
    deploymentCreationUnresolved = true;
    let created: any;
    try {
      const result = await command(['deploy', '--target', 'preview', '--force', '--yes', '--json', '--no-wait', '--meta', `codexVerificationId=${verificationRunId}-${index + 1}`], '', deploymentDirectory);
      const response = JSON.parse(result.stdout);
      const top = response && typeof response === 'object' ? response : undefined;
      const nested = top?.deployment && typeof top.deployment === 'object' ? top.deployment : undefined;
      deploymentResponseShape = { type: typeof response, topLevelKeys: top ? Object.keys(top).sort() : undefined, nestedDeploymentKeys: nested ? Object.keys(nested).sort() : undefined };
      created = [top, nested, nested?.deployment].find((candidate: any) => candidate && typeof (candidate.id ?? candidate.uid ?? candidate.deploymentId) === 'string' && typeof (candidate.url ?? candidate.deploymentUrl) === 'string');
      if (!created) throw Error('Deployment JSON did not include a recognized id and URL shape.');
    } catch {
      // Resolve an ambiguous CLI response using only this run's unique metadata.
      const listing = await command(['list', 'bis-server', '--json', '--limit', '100', '--meta', `codexVerificationId=${verificationRunId}-${index + 1}`]);
      const listed = JSON.parse(listing.stdout);
      const matches = Array.isArray(listed) ? listed : listed.deployments ?? [];
      const candidates = matches.filter((item: any) => item.meta?.codexVerificationId === `${verificationRunId}-${index + 1}` && item.target !== 'production' && (!item.meta?.githubCommitSha || item.meta.githubCommitSha === sourceCommit));
      assert.equal(candidates.length, 1, 'Ambiguous deployment must resolve to exactly one matching non-production deployment.');
      const candidate = candidates[0];
      const inspect = await command(['inspect', candidate.uid ?? candidate.id ?? candidate.url, '--json']);
      created = JSON.parse(inspect.stdout);
    }
    const deploymentId = created.id ?? created.uid ?? created.deploymentId;
    assert.equal(typeof deploymentId, 'string'); assert.match(deploymentId, /^dpl_[a-zA-Z0-9]+$/);
    deploymentIds.push(deploymentId); deploymentCreationUnresolved = false;
    const rawUrl = created.url ?? created.deploymentUrl;
    assert.equal(typeof rawUrl, 'string');
    const url = rawUrl.startsWith('https://') ? rawUrl : `https://${rawUrl}`;
    assert.match(url, /^https:\/\/bis-server-[a-z0-9-]+\.vercel\.app$/);
    deployments.push(url);
    stage = `Preview ${index + 1} readiness inspection`;
    const inspected = await command(['inspect', deploymentId, '--json', '--wait', '--timeout', '180s'], '', cwd, 240000);
    const readinessEnvelope = JSON.parse(inspected.stdout);
    const readinessNested = readinessEnvelope?.deployment && typeof readinessEnvelope.deployment === 'object' ? readinessEnvelope.deployment : undefined;
    readinessResponseShape = { type: typeof readinessEnvelope, topLevelKeys: readinessEnvelope && typeof readinessEnvelope === 'object' ? Object.keys(readinessEnvelope).sort() : undefined, nestedDeploymentKeys: readinessNested ? Object.keys(readinessNested).sort() : undefined };
    const readiness = readinessNested ?? readinessEnvelope;
    if (readiness.id !== deploymentId) { readinessValidationFailure = 'deployment-id-mismatch'; throw Error('Preview inspection returned a different deployment ID.'); }
    const normalizedHost = (value: string) => new URL(value.startsWith('https://') ? value : 'https://' + value).host.toLowerCase();
    readinessUrlHosts = { deploymentResponse: normalizedHost(rawUrl), inspectionResponse: normalizedHost(readiness.url) };
    if (readinessUrlHosts.inspectionResponse !== readinessUrlHosts.deploymentResponse) { readinessValidationFailure = 'url-host-mismatch'; throw Error('Preview inspection returned a different deployment host.'); }
    if (!(readiness.target === null || readiness.target === 'preview')) { readinessValidationFailure = 'target-not-preview'; throw Error('Inspected deployment is not Preview.'); }
    if (readiness.readyState !== 'READY') { readinessValidationFailure = 'state-' + String(readiness.readyState ?? 'missing').toLowerCase(); throw Error('Preview deployment did not reach READY.'); }
    stage = `Preview ${index + 1} protected health request`;
    const health = await call(url, '/api/bis/health');
    assert.equal(health.storage, 'ready'); assert.equal(health.ownerSigning, true); assert.equal(health.publicSigning, false);
  }
  assert.notEqual(deployments[0], deployments[1]);
  checks.push('two separate Ready Vercel deployments use isolated Preview Redis and identical reviewed server bundle');
  const fetcher: typeof fetch = async (url, init) => {
    const path = new URL(String(url)).pathname;
    const deployment = deployments[path.endsWith('/sign') ? signExchanges++ % 2 : requests % 2];
    requests++;
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    const headers = Object.fromEntries(new Headers(init?.headers).entries());
    const result = await call(deployment, path, body, headers);
    if (path.endsWith('/sign') && result.result !== undefined) {
      signingDeployments.add(deployment);
      remember(body.network);
      lastSigned = { body, headers, deployment, result };
      if (body.method === 'session.create') { lastSessionId = result.result; keys.add(`${ledgerFor(body.network)}:session:${result.result}`); }
    }
    return new Response(JSON.stringify(result), { status: result.error ? 503 : 200, headers: { 'Content-Type': 'application/json' } });
  };
  configureBisServer({ ownerToken: owner });
  stage = 'cross-deployment message signatures'; console.log(stage);
  const probe = await probeGameSigner('signet', { endpoint: deployments[0] + '/api/bis/', gameId, fetcher, timeoutMs: 30000 });
  assert.equal(probe.status, 'connected'); if (probe.status !== 'connected') throw Error('Preview connection failed.');
  const signetProfileId = probe.account.profileId;
  profileId = signetProfileId;
  const identity = remoteSigningIdentity(probe.account), message = new Uint8Array(32).fill(42);
  assert.equal(schnorr.verify(await identity.signMessage(message, 'schnorr'), message, await identity.xOnlyPublicKey()), true);
  stage = 'distinct Mutinynet Preview identity'; console.log(stage);
  const mutinynetProbe = await probeGameSigner('mutinynet', { endpoint: deployments[0] + '/api/bis/', gameId, fetcher, timeoutMs: 30000 });
  assert.equal(mutinynetProbe.status, 'connected'); if (mutinynetProbe.status !== 'connected') throw Error('Mutinynet Preview identity unavailable.');
  assert.notEqual(mutinynetProbe.account.profileId, signetProfileId, 'Preview network identities must be separate.');
  profileId = mutinynetProbe.account.profileId;
  const mutinynetIdentity = remoteSigningIdentity(mutinynetProbe.account), mutinynetMessage = new Uint8Array(32).fill(43);
  assert.equal(schnorr.verify(await mutinynetIdentity.signMessage(mutinynetMessage, 'schnorr'), mutinynetMessage, await mutinynetIdentity.xOnlyPublicKey()), true);
  checks.push('distinct ephemeral Signet and Mutinynet Preview identities each produce verified message signatures');
  profileId = signetProfileId;
  // Restore the Signet operation as the exact request used by the following
  // cross-deployment replay checks; never mix the network-specific ledgers.
  assert.equal(schnorr.verify(await identity.signMessage(message, 'schnorr'), message, await identity.xOnlyPublicKey()), true);
  const original = lastSigned!;
  const other = deployments.find(url => url !== original.deployment)!;
  assert.deepEqual(await call(other, '/api/bis/sign', original.body, original.headers), original.result);
  const changed = { ...original.body, args: encodeSigningValue([new Uint8Array(32).fill(43), 'schnorr']) };
  const grant = await call(other, '/api/bis/authorize', { request: changed, operationId: changed.operationId }, { Authorization: `Bearer ${owner}` });
  assert.ok((await call(other, '/api/bis/sign', changed, { ...original.headers, 'X-BIS-Signing-Grant': grant.grant })).error);
  checks.push('real message signature, exact committed retry on the other deployment and changed replay refusal');

  stage = 'concurrent deployed signing and conflicting input exclusion'; console.log(stage);
  const raceBody = { ...original.body, id: randomUUID() };
  const raceGrant = await call(deployments[0], '/api/bis/authorize', { request: raceBody, operationId: raceBody.operationId }, { Authorization: `Bearer ${owner}` });
  const raceHeaders = { ...original.headers, 'X-BIS-Signing-Grant': raceGrant.grant };
  const raced = await Promise.all(deployments.map(url => call(url, '/api/bis/sign', raceBody, raceHeaders)));
  const committed = raced.find(result => !result.error); assert.ok(committed);
  for (const result of raced.filter(result => !result.error)) assert.deepEqual(result, committed);
  for (const deployment of deployments) assert.deepEqual(await call(deployment, '/api/bis/sign', raceBody, raceHeaders), committed);
  checks.push('simultaneous calls on separate deployments converge on one committed result');
  stage = 'deployed transaction signing'; console.log(stage);
  const signetPhrase = previewMnemonics.BIS_PREVIEW_GAME_WALLET_SIGNET_01_MNEMONIC;
  const key = MnemonicIdentity.fromMnemonic(signetPhrase, { isMainnet: false });
  const payment = p2wpkh(await key.compressedPublicKey());
  const spend = new Transaction();
  spend.addInput({ txid: '88'.repeat(32), index: 0, witnessUtxo: { script: payment.script, amount: 500n } });
  spend.addOutput({ script: payment.script, amount: 499n });
  const spendBody = { ...original.body, id: randomUUID(), operationId: randomUUID(), method: 'sign', args: encodeSigningValue([spend, [0]]) };
  const spendGrant = await call(deployments[0], '/api/bis/authorize', { request: spendBody, operationId: spendBody.operationId }, { Authorization: `Bearer ${owner}` });
  const spendHeaders = { ...original.headers, 'X-BIS-Signing-Grant': spendGrant.grant };
  const signedSpend = await call(deployments[0], '/api/bis/sign', spendBody, spendHeaders);
  assert.ok(!signedSpend.error);
  const expected = await key.sign(Transaction.fromPSBT(spend.toPSBT()), [0]);
  assert.deepEqual(decodeSigningValue(signedSpend.result).getInput(0).partialSig, expected.getInput(0).partialSig);
  checks.push('deployed transaction input signature equals local SDK signature');
  stage = 'deployed conflicting input exclusion'; console.log(stage);
  const changedSpend = Transaction.fromPSBT(spend.toPSBT()); changedSpend.updateOutput(0, { amount: 498n });
  const conflictBody = { ...spendBody, id: randomUUID(), operationId: randomUUID(), args: encodeSigningValue([changedSpend, [0]]) };
  const conflictGrant = await call(deployments[1], '/api/bis/authorize', { request: conflictBody, operationId: conflictBody.operationId }, { Authorization: `Bearer ${owner}` });
  assert.ok((await call(deployments[1], '/api/bis/sign', conflictBody, { ...original.headers, 'X-BIS-Signing-Grant': conflictGrant.grant })).error);
  remember('signet');
  checks.push('a conflicting input request on the other deployment never signs');

  stage = 'cross-deployment encrypted MuSig'; console.log(stage);
  const remote = identity.signerSession(), local = MnemonicIdentity.fromMnemonic(signetPhrase, { isMainnet: false }).signerSession();
  const publicKeys = await Promise.all([remote.getPublicKey(), local.getPublicKey()]);
  const tx = new Transaction(); tx.addInput({ txid: '44'.repeat(32), index: 0 }); tx.addOutput({ script: fromHex('51'), amount: 500n });
  publicKeys.forEach((key, index) => setArkPsbtField(tx, 0, CosignerPublicKey, { index, key }));
  const tree = new TxTree(tx), root = new Uint8Array(32), amount = 1000n;
  await Promise.all([remote.init(tree, root, amount), local.init(tree, root, amount)]);
  const nonceSets = await Promise.all([remote.getNonces(), local.getNonces()]);
  assert.deepEqual(await remote.getNonces(), nonceSets[0]);
  const nonces = new Map(publicKeys.map((key, index) => [toHex(key.slice(1)), { pubNonce: nonceSets[index].get(tree.txid)!.pubNonce }]));
  await remote.aggregatedNonces(tree.txid, new Map(nonces)); await local.aggregatedNonces(tree.txid, new Map(nonces));
  const partials = await Promise.all([remote.sign(), local.sign()]);
  const sorted = sortKeys(publicKeys), untweaked = keyAggregate(sorted).aggPublicKey.toBytes(true);
  const tweak = schnorr.utils.taggedHash('TapTweak', untweaked.slice(1), root);
  const finalKey = keyAggregate(sorted, [tweak], [true]).aggPublicKey.toBytes(true);
  const digest = tx.preimageWitnessV1(0, [Uint8Array.from([0x51, 0x20, ...finalKey.slice(1)])], 0, [amount]);
  const session = new Session(nonceAggregate(sorted.map(key => nonces.get(toHex(key.slice(1)))!.pubNonce)), sorted, digest, [tweak], [true]);
  const signatures = sorted.map(key => partials[publicKeys.findIndex(candidate => toHex(candidate) === toHex(key))].get(tree.txid)!.encode());
  assert.equal(schnorr.verify(session.partialSigAgg(signatures), digest, finalKey.slice(1)), true);
  assert.equal(signingDeployments.size, 2);
  const completed = lastSigned!;
  assert.deepEqual(await call(deployments.find(url => url !== completed.deployment)!, '/api/bis/sign', completed.body, completed.headers), completed.result);
  checks.push('real two-party aggregate signature and final result replay survive exchanges between separate Vercel deployments');
  stage = 'deployed lost-session quarantine'; console.log(stage);
  assert.ok(lastSessionId);
  await redis.del(`${ledgerFor('signet')}:session:${lastSessionId}`);
  await assert.rejects(remote.getPublicKey());
  assert.equal(await redis.hexists(ledgerFor('signet'), 'lock'), 1);
  await assert.rejects(identity.signMessage(message, 'schnorr'));
  checks.push('lost encrypted session refuses signing and quarantines subsequent wallet requests across deployments');
} catch {
  console.error(`Vercel-instance acceptance failed during ${stage}. Raw credentials, CLI output and request bodies withheld.`);
  if (deploymentCreationUnresolved) {
    cleanup.deploymentsRemoved = false;
    console.error('Deployment creation outcome is unresolved; inspect the exact project before any retry.');
  }
  process.exitCode = 1;
} finally {
  configureBisServer({});
  for (const name of variables.reverse()) {
    try { await command(['env', 'rm', name, 'preview', '--yes']); }
    catch { cleanup.variablesRemoved = false; process.exitCode = 1; console.error(`Temporary Preview variable cleanup needs attention: ${name}.`); }
  }
  if (redis) for (const key of keys) {
    try { await redis.del(key); } catch { cleanup.testKeysRemoved = false; process.exitCode = 1; console.error('Exact scratch test-key cleanup failed.'); }
  }
  for (const id of deploymentIds) {
    try { await command(['remove', id, '--yes']); }
    catch { cleanup.deploymentsRemoved = false; process.exitCode = 1; console.error(`Disposable test deployment cleanup needs attention: ${id}.`); }
  }
  await mkdir(reportDirectory, { recursive: true });
  const report = { verifiedAt: new Date().toISOString(), passed: !process.exitCode, stage, provisioning, deployments, deploymentIds, deploymentCreationUnresolved, deploymentResponseShape, readinessResponseShape, readinessValidationFailure, readinessUrlHosts, signingDeployments: [...signingDeployments], cleanup, target: 'preview', productionChanged: false, source: 'local candidate, no commit or release implied', sourceCommit, verificationRunId, cliFailures, bundleSha256, checks, requests, isolatedScratchStorage: true, scratchLifetimeHours: 72, temporaryVariableNames: [...new Set(variables)], scope: 'Unfunded public fixture with real Vercel Node handlers and separate temporary Redis. Not funded Arkade workflow acceptance.' };
  await writeFile(new URL(`vercel-instance-verification-${verificationRunId}.json`, reportDirectory), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
}
