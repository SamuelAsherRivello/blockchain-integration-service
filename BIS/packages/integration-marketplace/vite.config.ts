import { defineConfig } from 'vite';
import { bisContentSecurityPolicy } from '../../scripts/content-security-policy.ts';

export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/blockchain-integration-service/marketplace/' : '/',
  plugins: [bisContentSecurityPolicy()],
}));
