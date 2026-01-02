import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/__tests__/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/dist/',
      ],
    },
  },
  resolve: {
    alias: {
      '@api-sdk/core': path.resolve(__dirname, '../api-sdk/src'),
      '@lib/date-utils': path.resolve(__dirname, '../lib/src/date-utils.ts'),
      '@lib/error-tracking': path.resolve(__dirname, '../lib/src/error-tracking.ts'),
      '@hooks/use-auth': path.resolve(__dirname, '../use-auth/src'),
    },
  },
});
