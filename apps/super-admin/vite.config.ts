import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@env-registry': path.resolve(__dirname, '../../packages/env-registry/src'),
      '@lib': path.resolve(__dirname, '../../packages/lib'),
    },
  },
  server: {
    port: 3002,
  },
});

