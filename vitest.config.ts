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
    alias: [
      // Fix broken relative paths from packages/ referencing apps/academy-admin/
      // e.g. ../../../apps/academy-admin/src/... from packages/hooks/*/src/
      // The relative path doesn't resolve correctly so we intercept the import specifier
      {
        find: /^(?:\.\.\/)+apps\/academy-admin\/src\/(.+)$/,
        replacement: path.resolve(__dirname, 'apps/academy-admin/src/$1'),
      },
      // env-registry (must be before @core)
      { find: '@env-registry', replacement: path.resolve(__dirname, './packages/env-registry/src') },
      // core packages (specific aliases BEFORE generic @core)
      { find: '@core/activity', replacement: path.resolve(__dirname, './packages/core/core-activity/src') },
      { find: '@core/analytics', replacement: path.resolve(__dirname, './packages/core/core-analytics/src') },
      { find: '@core/auth', replacement: path.resolve(__dirname, './packages/core/core-auth/src') },
      { find: '@core/automation', replacement: path.resolve(__dirname, './packages/core/core-automation/src') },
      { find: '@core/billing', replacement: path.resolve(__dirname, './packages/core/core-billing/src') },
      { find: '@core/calendar', replacement: path.resolve(__dirname, './packages/core/core-calendar/src') },
      { find: '@core/community', replacement: path.resolve(__dirname, './packages/core/core-community/src') },
      { find: '@core/config', replacement: path.resolve(__dirname, './packages/core/core-config/src') },
      { find: '@core/consultation', replacement: path.resolve(__dirname, './packages/core/core-consultation/src') },
      { find: '@core/coupons', replacement: path.resolve(__dirname, './packages/core/core-coupons/src') },
      { find: '@core/events', replacement: path.resolve(__dirname, './packages/core/core-events/src') },
      { find: '@core/metering', replacement: path.resolve(__dirname, './packages/core/core-metering/src') },
      { find: '@core/notification', replacement: path.resolve(__dirname, './packages/core/core-notification/src') },
      { find: '@core/party', replacement: path.resolve(__dirname, './packages/core/core-party/src') },
      { find: '@core/payment', replacement: path.resolve(__dirname, './packages/core/core-payment/src') },
      { find: '@core/pii-utils', replacement: path.resolve(__dirname, './packages/core/pii-utils/src') },
      { find: '@core/reviews', replacement: path.resolve(__dirname, './packages/core/core-reviews/src') },
      { find: '@core/schema-registry', replacement: path.resolve(__dirname, './packages/core/core-schema-registry/src') },
      { find: '@core/search', replacement: path.resolve(__dirname, './packages/core/core-search/src') },
      { find: '@core/storage', replacement: path.resolve(__dirname, './packages/core/core-storage/src') },
      { find: '@core/tags', replacement: path.resolve(__dirname, './packages/core/core-tags/src') },
      { find: '@core/tenancy', replacement: path.resolve(__dirname, './packages/core/core-tenancy/src') },
      { find: '@core/tenancy-referral', replacement: path.resolve(__dirname, './packages/core/core-tenancy-referral/src') },
      { find: '@core', replacement: path.resolve(__dirname, './packages/core') },
      // schema-engine
      { find: '@schema-engine', replacement: path.resolve(__dirname, './packages/schema-engine/src') },
      // industry
      { find: '@industry/registry', replacement: path.resolve(__dirname, './packages/industry/industry-registry.ts') },
      { find: '@industry/academy', replacement: path.resolve(__dirname, './packages/industry/industry-academy/src') },
      // ui
      { find: '@ui-core/react', replacement: path.resolve(__dirname, './packages/ui-core/src') },
      // lib
      { find: '@lib/supabase-client', replacement: path.resolve(__dirname, './packages/lib/supabase-client/src') },
      { find: '@lib/error-tracking', replacement: path.resolve(__dirname, './packages/lib/error-tracking/src') },
      { find: '@lib/react-query-config', replacement: path.resolve(__dirname, './packages/lib/react-query-config/src') },
      { find: '@lib/date-utils', replacement: path.resolve(__dirname, './packages/lib/date-utils/src') },
      { find: '@lib', replacement: path.resolve(__dirname, './packages/lib') },
      // hooks, services, api-sdk
      { find: '@hooks', replacement: path.resolve(__dirname, './packages/hooks') },
      { find: '@services', replacement: path.resolve(__dirname, './packages/services') },
      { find: '@api-sdk/core', replacement: path.resolve(__dirname, './packages/api-sdk/src') },
      // test utilities
      { find: '@test-utils', replacement: path.resolve(__dirname, './packages/test-utils/src') },
      // Stub for uninstalled peer dependencies (needed for vi.mock to intercept)
      { find: '@supabase/auth-helpers-react', replacement: path.resolve(__dirname, './packages/test-utils/stubs/supabase-auth-helpers-react.ts') },
    ],
  },
});
