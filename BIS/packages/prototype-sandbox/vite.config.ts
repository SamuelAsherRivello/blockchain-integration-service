import { defineConfig } from 'vite';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const entries = ['index.html', 'setup/index.html', 'events-monitor/index.html', ...readdirSync(fileURLToPath(new URL('.', import.meta.url))).filter(name => /^demo-\d+$/.test(name)).map(name => `${name}/index.html`)];
export default defineConfig({
  optimizeDeps: { exclude: ['mermaid'] },
  build: { rolldownOptions: { input: entries.map(entry => fileURLToPath(new URL(entry, import.meta.url))) } },
});
