import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['packages/**/*.test.ts', 'packages/**/*.test.tsx'],
    exclude: [
      'node_modules/',
      'dist/',
      'build/',
      'tests/**',
      '**/*.spec.ts',
    ],
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
        'tests/e2e/**',
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
      '@core/auth': path.resolve(__dirname, './packages/core/core-auth/src'),
      '@core/billing': path.resolve(__dirname, './packages/core/core-billing/src'),
      '@core': path.resolve(__dirname, './packages/core'),
      '@ui-core/react': path.resolve(__dirname, './packages/ui-core/src'),
      '@lib/supabase-client': path.resolve(__dirname, './packages/lib/supabase-client/src'),
      '@lib/error-tracking': path.resolve(__dirname, './packages/lib/error-tracking/src'),
      '@lib/react-query-config': path.resolve(__dirname, './packages/lib/react-query-config/src'),
      '@lib': path.resolve(__dirname, './packages/lib'),
      '@hooks': path.resolve(__dirname, './packages/hooks'),
      '@services': path.resolve(__dirname, './packages/services'),
      '@api-sdk/core': path.resolve(__dirname, './packages/api-sdk/src'),
    },
  },
});

