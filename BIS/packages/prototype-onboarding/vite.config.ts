import {defineConfig} from 'vite';
import {bisContentSecurityPolicy} from '../../scripts/content-security-policy.ts';

export default defineConfig({plugins:[bisContentSecurityPolicy()]});
