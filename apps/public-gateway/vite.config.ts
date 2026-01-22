import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  // 앱 디렉토리의 .env.local 파일 사용
  // Vite 캐시를 루트로 통합
  cacheDir: path.resolve(__dirname, '../../node_modules/.vite'),
  // define 옵션 제거 - Vite가 .env.local에서 VITE_* 변수를 자동 로드
  plugins: [react()],
  test: {
    // Vitest 설정: e2e 폴더와 playwright 파일 제외
    exclude: ['node_modules', 'dist', 'e2e', '**/*.e2e.{test,spec}.{js,ts}', '**/playwright.config.ts'],
    environment: 'jsdom',
  },
  // React 중복 인스턴스 방지
  optimizeDeps: {
    include: ['react', 'react-dom', '@tanstack/react-query'],
  },
  resolve: {
    dedupe: ['react', 'react-dom', '@tanstack/react-query'],
    alias: [
      { find: '@ui-core/react/styles', replacement: path.resolve(__dirname, '../../packages/ui-core/src/styles.css') },
      { find: '@ui-core/react', replacement: path.resolve(__dirname, '../../packages/ui-core/src') },
      { find: '@lib/supabase-client/server', replacement: path.resolve(__dirname, '../../packages/lib/supabase-client/src/server.ts') },
      { find: '@lib/supabase-client/db', replacement: path.resolve(__dirname, '../../packages/lib/supabase-client/src/db.ts') },
      { find: '@lib/supabase-client', replacement: path.resolve(__dirname, '../../packages/lib/supabase-client/src') },
      { find: '@env-registry/core/server', replacement: path.resolve(__dirname, '../../packages/env-registry/src/server.ts') },
      { find: '@env-registry/core', replacement: path.resolve(__dirname, '../../packages/env-registry/src') },
      { find: '@core/tags', replacement: path.resolve(__dirname, '../../packages/core/core-tags/src') },
      { find: '@core/schema-registry', replacement: path.resolve(__dirname, '../../packages/core/core-schema-registry/src') },
      { find: '@core/auth', replacement: path.resolve(__dirname, '../../packages/core/core-auth/src') },
      { find: '@core/auth/login', replacement: path.resolve(__dirname, '../../packages/core/core-auth/src/login.ts') },
      { find: '@core/auth/signup', replacement: path.resolve(__dirname, '../../packages/core/core-auth/src/signup.ts') },
      { find: '@core/auth/service', replacement: path.resolve(__dirname, '../../packages/core/core-auth/src/service.ts') },
      { find: '@core/auth/types', replacement: path.resolve(__dirname, '../../packages/core/core-auth/src/types.ts') },
      { find: '@core/tenancy', replacement: path.resolve(__dirname, '../../packages/core/core-tenancy/src') },
      { find: '@core/tenancy/service', replacement: path.resolve(__dirname, '../../packages/core/core-tenancy/src/service.ts') },
      { find: '@core/tenancy/onboarding', replacement: path.resolve(__dirname, '../../packages/core/core-tenancy/src/onboarding.ts') },
      { find: '@core/config', replacement: path.resolve(__dirname, '../../packages/core/core-config/src') },
      { find: '@env-registry', replacement: path.resolve(__dirname, '../../packages/env-registry/src') },
      { find: '@lib', replacement: path.resolve(__dirname, '../../packages/lib') },
      { find: '@design-system/core', replacement: path.resolve(__dirname, '../../packages/design-system/src') },
      { find: '@design-system', replacement: path.resolve(__dirname, '../../packages/design-system/src') },
      { find: '@ui-core', replacement: path.resolve(__dirname, '../../packages/ui-core/src') },
      { find: '@schema/engine', replacement: path.resolve(__dirname, '../../packages/schema-engine/src') },
      { find: '@schema-engine', replacement: path.resolve(__dirname, '../../packages/schema-engine/src') },
      { find: '@industry/academy/service', replacement: path.resolve(__dirname, '../../packages/industry/industry-academy/src/service.ts') },
      { find: '@industry/academy', replacement: path.resolve(__dirname, '../../packages/industry/industry-academy/src') },
      { find: '@industry', replacement: path.resolve(__dirname, '../../packages/industry') },
      { find: '@api-sdk/core', replacement: path.resolve(__dirname, '../../packages/api-sdk/src') },
      { find: '@api-sdk', replacement: path.resolve(__dirname, '../../packages/api-sdk/src') },
      { find: '@services/class-service', replacement: path.resolve(__dirname, '../../packages/services/class-service/src') },
      { find: '@services', replacement: path.resolve(__dirname, '../../packages/services') },
      { find: '@hooks/use-class', replacement: path.resolve(__dirname, '../../packages/hooks/use-class/src') },
      { find: '@hooks/use-auth', replacement: path.resolve(__dirname, '../../packages/hooks/use-auth/src') },
      { find: '@hooks', replacement: path.resolve(__dirname, '../../packages/hooks') },
      { find: '@core', replacement: path.resolve(__dirname, '../../packages/core') },
    ],
  },
  server: {
    port: 3003,
  },
});
