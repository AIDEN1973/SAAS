import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
  plugins: [
    react(),
    // Bundle analyzer (개발 시에만)
    process.env.ANALYZE && visualizer({
      open: true,
      filename: 'dist/stats.html',
      gzipSize: true,
      brotliSize: true,
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      '@env-registry': path.resolve(__dirname, '../../packages/env-registry/src'),
      '@lib': path.resolve(__dirname, '../../packages/lib'),
      '@design-system': path.resolve(__dirname, '../../packages/design-system/src'),
      '@ui-core': path.resolve(__dirname, '../../packages/ui-core/src'),
      '@schema-engine': path.resolve(__dirname, '../../packages/schema-engine/src'),
      '@api-sdk': path.resolve(__dirname, '../../packages/api-sdk/src'),
      '@services': path.resolve(__dirname, '../../packages/services'),
      '@hooks': path.resolve(__dirname, '../../packages/hooks'),
    },
  },
  server: {
    port: 3000,
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'design-system': ['@design-system/core'],
          'ui-core': ['@ui-core/react'],
        },
      },
    },
    // Chunk size warning limit (500KB)
    chunkSizeWarningLimit: 500,
  },
});

