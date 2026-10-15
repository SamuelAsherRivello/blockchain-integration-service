import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const authoredJavaScript = /\.(?:js|jsx|mjs|cjs)$/i;
const referencePattern = /(?:from\s+|import\(\s*|new URL\(\s*)["'`](?:\.\.?\/)[^"'`\r\n]+\.(?:js|jsx|mjs|cjs)["'`]/i;
const generatedReference = /["'`]\.\.?\/[^"'`\r\n]*\/dist\//i;
const inspectableExtensions = /\.(?:json|mjs|cjs|js|jsx|ts|tsx|md|yaml|yml)$/i;
const excludedPath = /^(?:node_modules|dist|output|\.git)\//i;

const repositoryFiles = [
  ...execFileSync('git', ['ls-files'], { encoding: 'utf8' }).split(/\r?\n/),
  ...execFileSync('git', ['ls-files', '--others', '--exclude-standard'], { encoding: 'utf8' }).split(/\r?\n/),
]
  .filter((path, index, files) => path.length > 0 && files.indexOf(path) === index && existsSync(path));

const trackedFiles = repositoryFiles

const inScopeFiles = trackedFiles.filter(
  (path) => path.startsWith('BIS/packages/') || path.startsWith('BIS/scripts/'),
);
const javascriptFiles = inScopeFiles.filter((path) => authoredJavaScript.test(path));
const staleReferences = inScopeFiles.flatMap((path) => {
  if (excludedPath.test(path) || !inspectableExtensions.test(path)) {
    return [];
  }

  const contents = readFileSync(path, 'utf8');
  return referencePattern.test(contents) && !generatedReference.test(contents) ? [path] : [];
});

console.log(`In-scope authored JavaScript files: ${javascriptFiles.length}`);
javascriptFiles.forEach((path) => console.log(`  ${path}`));
console.log(`Files with possible stale JavaScript references: ${staleReferences.length}`);
staleReferences.forEach((path) => console.log(`  ${path}`));

if (process.argv.includes('--check') && (javascriptFiles.length > 0 || staleReferences.length > 0)) {
  process.exitCode = 1;
}
