import react from '@vitejs/plugin-react';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root,
  plugins: [react()],
  resolve: {
    alias: [{
      find: /^@dashboard-render-sdk-g\/provider-13$/,
      replacement: resolve(root, '../../artifacts/sdk/provider-13/provider.js'),
    }],
    dedupe: ['react', 'react-dom'],
  },
  server: {
    allowedHosts: ['host', 'localhost'],
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
  },
  preview: {
    allowedHosts: ['host', 'localhost'],
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: resolve(root, '../../artifacts/standalone-demo'),
    emptyOutDir: true,
  },
});
