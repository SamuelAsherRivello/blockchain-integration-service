import { spawn } from 'node:child_process';

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const runner = process.platform === 'win32' ? process.env.ComSpec : npmCommand;
const runnerArgs = script => process.platform === 'win32'
  ? ['/d', '/s', '/c', `${npmCommand} run ${script}`]
  : ['run', script];
const children = [
  spawn(runner, runnerArgs('dev:admin'), { stdio: 'inherit', shell: false }),
  spawn(runner, runnerArgs('dev:marketplace'), { stdio: 'inherit', shell: false }),
];

let shuttingDown = false;

function stopAll(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) child.kill('SIGTERM');
  setTimeout(() => process.exit(exitCode), 250);
}

for (const child of children) {
  child.once('error', error => {
    console.error(error);
    stopAll(1);
  });
  child.once('exit', code => {
    if (!shuttingDown && code !== 0) stopAll(code ?? 1);
  });
}

process.once('SIGINT', () => stopAll());
process.once('SIGTERM', () => stopAll());
