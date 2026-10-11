import { pathToFileURL } from 'node:url';
import { createInterface } from 'node:readline';
import { argumentsFor } from './arguments.mjs';
import { publicFailure, fail } from './errors.mjs';

const help = {
  command: 'test-wallets',
  available: ['init [--origin <exact-loopback-origin>]', 'import --shared | --input <private-absolute-path>', 'create --account <label> --network signet|mutinynet',
    'status [--account <label>] [--network signet|mutinynet] [--live]',
    'assign --pair <label> --player <label> --game <label> --network signet|mutinynet',
    'open --pair <label> --origin <registered-origin> --app marketplace|admin',
    'join --origin <exact-loopback-origin> --app marketplace --api <supplied-loopback-CDP-origin> --page <explicit-target-id>',
    'fund --account <label> --network signet|mutinynet --source faucet --amount 50000|100000|200000 --operation <unique-label> [--api <loopback-origin>]'],
  pending: ['standalone inspect', 'action', 'run', 'standalone wallet funding', 'direct test-wallet BTC sends', 'prepare', 'rotate'],
  note: 'Recovery input is private local input only. Creation does not establish funding or readiness.',
};
export async function execute(argv, { makeVault, inventory } = {}) {
  const { command, values } = argumentsFor(argv); // Validate before loading any wallet material.
  if (command === 'help') return { ok: true, ...help };
  if (command === 'join') fail('join-requires-session-transport');
  if (!['init', 'import', 'create', 'status', 'assign', 'open', 'fund'].includes(command)) fail('command-not-yet-implemented');
  const { Vault } = await import('./vault.mjs');
  const vault = makeVault ? makeVault() : new Vault();
  if (command === 'init') {
    await vault.initialize();
    if (values.origin) await (await import('./owned-browser.mjs')).configureApplications(vault, values.origin);
    return { ok: true, initialized: true };
  }
  if (command === 'open') fail('open-requires-session-transport');
  if (command === 'fund') return { ok: true, ...await (await import('./funding.mjs')).fund(vault, values) };
  const api = inventory ?? await import('./inventory.mjs');
  let result;
  if (command === 'import') result = values.shared ? await api.importSharedAccounts(vault) : await api.importAccounts(vault, values.input);
  if (command === 'create') result = await api.create(vault, values.account, values.network);
  if (command === 'status') result = values.live ? await (await import('./observations.mjs')).observe(vault, values) : await api.status(vault, values);
  if (command === 'assign') result = await api.assign(vault, values);
  return { ok: true, ...result };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  // SDK/provider console output is not a public runner result. It can include
  // sensitive request context; stdout is reserved for our explicit JSON writes.
  for (const method of ['log', 'info', 'warn', 'error', 'debug', 'trace', 'dir']) console[method] = () => {};
  try {
    const args = process.argv.slice(2), parsed = argumentsFor(args);
    if (!['open', 'join'].includes(parsed.command)) process.stdout.write(`${JSON.stringify(await execute(args))}\n`);
    else {
      const joined = parsed.command === 'join';
      let owner;
      if (joined) {
        const { JoinedBrowser } = await import('./joined-browser.mjs');
        owner = new JoinedBrowser(parsed.values);
      } else {
        const { Vault } = await import('./vault.mjs');
        const { OwnedBrowser } = await import('./owned-browser.mjs');
        owner = new OwnedBrowser(new Vault(), parsed.values);
      }
      let input;
      try {
        process.stdout.write(`${JSON.stringify({ ok: true, ...await owner.start() })}\n`);
        input = createInterface({ input: process.stdin, crlfDelay: Infinity });
        for await (const line of input) {
          try {
            if (line.length > 4096) fail('invalid-session-command');
            const request = JSON.parse(line);
            if (joined) {
              const result = await owner.request(request);
              if (result.detached) { input.close(); process.stdin.pause(); process.stdin.unref?.(); }
              process.stdout.write(`${JSON.stringify({ ok: true, ...result })}\n`);
              if (result.detached) break;
              continue;
            }
            if (request.command === 'close') {
              await owner.close();
              input.close(); process.stdin.pause(); process.stdin.unref?.();
              process.stdout.write('{"ok":true,"closed":true}\n');
              break;
            }
            let result;
            if (request.command === 'inspect') result = await owner.inspect();
            else if (request.command === 'run' && request.scenario === 'reload') result = await owner.reload(request);
            else if (request.command === 'run' && request.scenario === 'logout') result = await owner.logout(request);
            else if (request.command === 'run' && request.scenario === 'restore') result = await owner.restore(request);
            else if (request.command === 'action' && request.type === 'navigate') {
              if (Object.keys(request).some(key => !['command', 'type', 'screen'].includes(key))) fail('invalid-session-command');
              result = await owner.navigate(request.screen);
            }
            else if (request.command === 'run' && ['payment', 'funding'].includes(request.scenario)) result = await owner.payment(request);
            else if (request.command === 'run' && request.scenario === 'swap-to-bitcoin') result = await owner.swap(request);
            else fail('command-not-yet-implemented');
            process.stdout.write(`${JSON.stringify({ ok: true, ...result })}\n`);
          } catch (error) { process.stdout.write(`${JSON.stringify(publicFailure(error))}\n`); }
        }
      } finally {
        input?.close(); process.stdin.pause(); process.stdin.unref?.();
        await owner.close();
      }
    }
  }
  catch (error) { process.stdout.write(`${JSON.stringify(publicFailure(error))}\n`); process.exitCode = 1; }
}
