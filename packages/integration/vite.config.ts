import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: { entry: 'src/index.ts', formats: ['es'], fileName: 'integration', cssFileName: 'integration' },
    rollupOptions: { external: ['react', 'react-dom', 'react/jsx-runtime'] },
  },
});
