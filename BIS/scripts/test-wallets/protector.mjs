import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { fail, WalletToolError } from './errors.mjs';

const helper = fileURLToPath(new URL('./protector.ps1', import.meta.url));
export function windowsProtector({ executable = 'pwsh', timeout = 15000 } = {}) {
  async function invoke(mode, target, bytes) {
    if (process.platform !== 'win32') fail('vault-protection-unavailable');
    return new Promise((resolve, reject) => {
      const args = ['-NoLogo', '-NoProfile', '-NonInteractive', '-File', helper, '-Mode', mode];
      if (target) args.push('-Target', target);
      const child = spawn(executable, args, { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
      let output = '', size = 0, finished = false;
      const finish = (error, value) => {
        if (finished) return;
        finished = true; clearTimeout(timer);
        if (error) reject(new WalletToolError('vault-protection-unavailable')); else resolve(value);
      };
      const timer = setTimeout(() => { child.kill(); finish(true); }, timeout);
      child.on('error', () => finish(true));
      child.stdin.on('error', () => finish(true));
      child.stdout.on('data', data => {
        size += data.length;
        if (size > 4 * 1024 * 1024) { child.kill(); finish(true); } else output += data.toString('utf8');
      });
      child.stderr.resume();
      child.on('close', code => {
        if (code !== 0) return finish(true);
        if (mode === 'secure' || mode === 'check') return finish(output !== 'ok', undefined);
        if (!/^[A-Za-z0-9+/]+={0,2}$/.test(output)) return finish(true);
        finish(false, Buffer.from(output, 'base64'));
      });
      child.stdin.end(bytes ? bytes.toString('base64') : '');
    });
  }
  return {
    protect: bytes => invoke('protect', undefined, bytes),
    unprotect: bytes => invoke('unprotect', undefined, bytes),
    secure: path => invoke('secure', path),
    check: path => invoke('check', path),
  };
}
