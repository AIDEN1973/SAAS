// @ts-nocheck
import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// 서버 전용 코드를 클라이언트 번들에서 제외하는 플러그인
function excludeServerCode(): Plugin {
  return {
    name: 'exclude-server-code',
    resolveId(id) {
      // 서버 전용 모듈을 빈 모듈로 대체
      if (
        id.includes('/server') ||
        id === '@env-registry/core/server' ||
        id === '@lib/supabase-client/server' ||
        id === '@core/schema-registry' ||
        id.includes('core-schema-registry')
      ) {
        // 클라이언트 빌드에서는 빈 모듈 반환
        return { id: 'data:text/javascript,export default {}', external: true };
      }
      return null;
    },
    load(id) {
      // 서버 전용 파일을 빈 모듈로 대체
      if (
        id.includes('/server.ts') ||
        id.includes('/server.js') ||
        id.includes('core-schema-registry')
      ) {
        return 'export default {};';
      }
      return null;
    },
  };
}

export default defineConfig({
  // 프로젝트 루트의 .env.local 파일을 로드
  envDir: path.resolve(__dirname, '../..'),
  // Vercel 빌드 시 환경변수를 빌드 타임에 주입
  define: {
    // 환경변수가 없으면 개발용 기본값 사용 (프로덕션에서는 반드시 환경변수 설정 필요)
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(
      process.env.VITE_SUPABASE_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      'https://xawypsrotrfoyozhrsbb.supabase.co'
    ),
    'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(
      process.env.VITE_SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhhd3lwc3JvdHJmb3lvemhyc2JiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ5NDQ2MDYsImV4cCI6MjA4MDUyMDYwNn0.gH0THgnxtn2WCroHo2Sn1mtLsFzuq4FXJzqs0Rcfws0'
    ),
    'import.meta.env.VITE_KAKAO_JS_KEY': JSON.stringify(process.env.VITE_KAKAO_JS_KEY || process.env.NEXT_PUBLIC_KAKAO_JS_KEY || ''),
  },
  plugins: [react(), excludeServerCode()],
  resolve: {
    alias: [
      { find: '@ui-core/react/styles', replacement: path.resolve(__dirname, '../../packages/ui-core/src/styles.css') },
      { find: '@ui-core/react', replacement: path.resolve(__dirname, '../../packages/ui-core/src') },
      { find: '@lib/supabase-client/server', replacement: path.resolve(__dirname, '../../packages/lib/supabase-client/src/server.ts') },
      { find: '@lib/supabase-client/db', replacement: path.resolve(__dirname, '../../packages/lib/supabase-client/src/db.ts') },
      { find: '@lib/supabase-client', replacement: path.resolve(__dirname, '../../packages/lib/supabase-client/src') },
      { find: '@env-registry/core/server', replacement: path.resolve(__dirname, '../../packages/env-registry/src/server.ts') },
      { find: '@env-registry/core', replacement: path.resolve(__dirname, '../../packages/env-registry/src') },
      { find: '@core/auth', replacement: path.resolve(__dirname, '../../packages/core/core-auth/src') },
      { find: '@core/tenancy/onboarding', replacement: path.resolve(__dirname, '../../packages/core/core-tenancy/src/onboarding.ts') },
      { find: '@core/tenancy', replacement: path.resolve(__dirname, '../../packages/core/core-tenancy/src') },
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
      { find: '@schema-engine', replacement: path.resolve(__dirname, '../../packages/schema-engine/src') },
      { find: '@industry/academy/service', replacement: path.resolve(__dirname, '../../packages/industry/industry-academy/src/service.ts') },
      { find: '@industry/academy', replacement: path.resolve(__dirname, '../../packages/industry/industry-academy/src') },
      { find: '@industry', replacement: path.resolve(__dirname, '../../packages/industry') },
      { find: '@api-sdk/core', replacement: path.resolve(__dirname, '../../packages/api-sdk/src') },
      { find: '@api-sdk', replacement: path.resolve(__dirname, '../../packages/api-sdk/src') },
      { find: '@services', replacement: path.resolve(__dirname, '../../packages/services') },
      { find: '@hooks', replacement: path.resolve(__dirname, '../../packages/hooks') },
      { find: '@core', replacement: path.resolve(__dirname, '../../packages/core') },
    ],
  },
  optimizeDeps: {
    exclude: [
      // 서버 전용 코드는 클라이언트 번들에서 제외
      '@lib/supabase-client/server',
      '@env-registry/core/server',
      '@core/schema-registry',
    ],
  },
  server: {
    port: 3002,
  },
});

