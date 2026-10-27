import { parseArgs } from 'node:util';
import { fail } from './errors.ts';
import { readinessTarget } from './readiness.ts';

export const commands = ['init', 'import', 'create', 'status', 'assign', 'open', 'inspect', 'action', 'run', 'fund', 'reconcile', 'prepare', 'join', 'detach', 'rotate'];
export const scenarios = ['reload', 'logout', 'restore', 'payment', 'funding', 'funding-bitcoin', 'swap-to-bitcoin', 'mint-delivery', 'burn', 'onboard-half', 'contract-claim', 'contract-refund'];
export function label(value) {
  if (typeof value !== 'string' || !/^[a-z][a-z0-9-]{0,47}$/.test(value)) fail('invalid-account-label');
  return value;
}
export function network(value) {
  if (value !== 'signet' && value !== 'mutinynet') fail('unsupported-network');
  return value;
}
export function origin(value, { app } = {}) {
  let url;
  try { url = new URL(value); } catch { fail('invalid-origin'); }
  const loopback = url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
  const publishedGame = app === 'game' && url.origin === 'https://samuelasherrivello.github.io' && url.protocol === 'https:';
  if ((!loopback && !publishedGame) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) fail('invalid-origin');
  return url.origin;
}
export function argumentsFor(argv) {
  let parsed;
  try {
    parsed = parseArgs({ args: argv, allowPositionals: true, strict: true, options: {
      help: { type: 'boolean', short: 'h' }, account: { type: 'string' }, input: { type: 'string' },
      network: { type: 'string' }, role: { type: 'string' }, origin: { type: 'string' },
      scenario: { type: 'string' }, player: { type: 'string' }, game: { type: 'string' },
      pair: { type: 'string' }, live: { type: 'boolean' },
      expect: { type: 'string' }, bitcoin: { type: 'string' }, arkade: { type: 'string' },
      app: { type: 'string' },
      'recovery-profile': { type: 'string' },
      page: { type: 'string' },
      shared: { type: 'boolean' },
      source: { type: 'string' }, amount: { type: 'string' }, operation: { type: 'string' }, api: { type: 'string' },
    } });
  } catch { fail('invalid-arguments'); }
  const { values, positionals } = parsed;
  if (positionals.length > 1) fail('invalid-arguments');
  const command = positionals[0];
  if (values.help || !command) return { command: 'help' };
  if (!commands.includes(command)) fail('unknown-command');
  if (values.network !== undefined) network(values.network);
  for (const key of ['account', 'player', 'game', 'pair']) if (values[key] !== undefined) label(values[key]);
  if (values.role !== undefined && !['player', 'game'].includes(values.role)) fail('invalid-role');
  if (values.scenario !== undefined && !scenarios.includes(values.scenario)) fail('invalid-scenario');
  if (values.app !== undefined && !['admin', 'marketplace', 'onboarding', 'faucet', 'game'].includes(values.app)) fail('invalid-application');
  if (values.origin !== undefined) values.origin = origin(values.origin, { app: ['init', 'open'].includes(command) ? values.app : undefined });
  if (command === 'init' && (values.app !== undefined && values.app !== 'game' || values.app === 'game' && !values.origin)) fail('invalid-application');
  if (command === 'create' && (!values.account || !values.network)) fail('missing-account-or-network');
  if (command === 'rotate' && (!values.account || !values.network)) fail('missing-account-or-network');
  readinessTarget(values);
  if (values.expect !== undefined && command !== 'prepare' && (command !== 'status' || !values.live)) fail('readiness-requires-live-status');
  if (command === 'import' && (!values.input && !values.shared || values.input && values.shared)) fail('choose-one-private-input');
  if (command === 'assign' && (!values.pair || !values.player || !values.game || !values.network)) fail('missing-pair-arguments');
  if (command === 'open' && (!values.pair || !values.origin || !values.app)) fail('missing-browser-arguments');
  if (values['recovery-profile'] !== undefined) {
    if (command !== 'open' || !/^[a-z][a-z0-9-]{0,39}$/.test(values['recovery-profile'])) fail('invalid-recovery-profile');
    values.recoveryProfile = values['recovery-profile'];
    delete values['recovery-profile'];
  }
  if (command === 'join') {
    if (!values.origin || values.app !== 'marketplace' || !values.api || !/^[a-fA-F0-9]{32}$/.test(values.page ?? ''))
      fail('missing-joined-connection-arguments');
    values.api = origin(values.api);
  }
  if (command === 'fund') {
    if (!values.account || !values.network || !values.operation || values.source !== 'faucet') fail('missing-funding-arguments');
    label(values.operation);
    if (!['1000', '50000', '100000', '200000'].includes(values.amount)) fail('invalid-funding-amount');
    if (values.api !== undefined) values.api = origin(values.api);
  }
  if (command === 'reconcile') label(values.operation);
  if (command === 'prepare') {
    if (!values.account || !values.network || !values.expect) fail('missing-preparation-target');
    if (values.source !== undefined) {
      if (values.expect !== 'funded' || values.source !== 'faucet' || !values.operation || !['1000', '50000', '100000', '200000'].includes(values.amount)) fail('invalid-preparation-funding');
      label(values.operation);
      if (values.api !== undefined) values.api = origin(values.api);
    } else if (['amount', 'operation', 'api'].some(key => values[key] !== undefined)) fail('invalid-preparation-funding');
  }
  const allowed = {
    init: ['origin', 'app'], import: ['input', 'shared'], create: ['account', 'network'], rotate: ['account', 'network'], status: ['network', 'account', 'live', 'expect', 'bitcoin', 'arkade'],
    assign: ['pair', 'player', 'game', 'network'],
    open: ['pair', 'origin', 'app', 'recoveryProfile'],
    join: ['origin', 'app', 'api', 'page'],
    fund: ['account', 'network', 'source', 'amount', 'operation', 'api'],
    reconcile: ['operation'],
    prepare: ['account', 'network', 'expect', 'bitcoin', 'arkade', 'source', 'amount', 'operation', 'api'],
  }[command];
  if (allowed && Object.keys(values).some(key => !allowed.includes(key))) fail('invalid-arguments');
  return { command, values };
}

