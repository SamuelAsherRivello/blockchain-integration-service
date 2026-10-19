import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Compatibility entry point. All execution goes through the maintained,
// grant-checked, protected-journal runner. No browser storage or old local vault
// object can stand in for a real contract or receipt.
const args = new Map<string, string>();
for (let index = 2; index < process.argv.length; index += 2) {
  if (!['--network', '--account', '--id', '--run'].includes(process.argv[index]) || !process.argv[index + 1]) throw Error('vault-live-use-network-account-id-run');
  args.set(process.argv[index], process.argv[index + 1]);
}
const network = args.get('--network'), account = args.get('--account'), id = args.get('--id'), run = args.get('--run');
if (!['signet', 'mutinynet'].includes(network ?? '') || !account || !/^\d{4}$/.test(id ?? '') || !/^cv-[a-z0-9-]{1,35}$/.test(run ?? '')) throw Error('vault-live-use-network-account-id-run');
const exitCode = await new Promise<number | null>((resolve, reject) => {
  const child = spawn(process.execPath, [fileURLToPath(new URL('./conditional-vault-acceptance.ts', import.meta.url)), network!, account, id!, run!], { windowsHide: true, stdio: 'inherit' });
  child.on('error', reject); child.on('close', resolve);
});
process.exitCode = exitCode ?? 1;
