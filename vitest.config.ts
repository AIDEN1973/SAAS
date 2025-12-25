import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        'build/',
        '**/*.config.*',
        '**/*.d.ts',
        '**/types.ts',
        '**/types/**',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
  resolve: {
    alias: {
      '@env-registry': path.resolve(__dirname, './packages/env-registry/src'),
      '@core': path.resolve(__dirname, './packages/core'),
      '@ui-core/react': path.resolve(__dirname, './packages/ui-core/src'),
      '@lib': path.resolve(__dirname, './packages/lib'),
      '@hooks': path.resolve(__dirname, './packages/hooks'),
      '@services': path.resolve(__dirname, './packages/services'),
    },
  },
});

