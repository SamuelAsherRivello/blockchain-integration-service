import { defineConfig } from 'vite';
import { bisContentSecurityPolicy } from '../../scripts/content-security-policy.ts';

export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/blockchain-integration-service/integration-marketplace/' : '/',
  plugins: [bisContentSecurityPolicy()],
}));
