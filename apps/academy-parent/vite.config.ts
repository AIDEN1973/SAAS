import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  // 프로젝트 루트의 .env.local 파일을 로드
  const envDir = path.resolve(__dirname, '../..');

  // 근본 원인: process.env에 잘못된 값이 있으면 loadEnv가 그것을 우선시함
  // 해결: process.env의 잘못된 값을 임시로 백업하고 제거한 후 loadEnv 호출
  const originalProcessEnv: Record<string, string | undefined> = {};
  const envKeysToBackup = ['VITE_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL'];

  // 잘못된 URL이 포함된 process.env 값 백업 및 제거
  envKeysToBackup.forEach(key => {
    if (process.env[key] && process.env[key]!.includes('npferbxuxocbfnfbpcnz')) {
      originalProcessEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  try {
    // loadEnv는 다음 순서로 로드: .env.[mode].local > .env.local > .env.[mode] > .env
    // process.env의 잘못된 값을 제거했으므로, .env.local의 올바른 값이 로드됨
    const env = loadEnv(mode, envDir, '');

    // 환경변수 우선순위: NEXT_PUBLIC_* > VITE_* (잘못된 URL 필터링)
    // NEXT_PUBLIC_* 우선 사용, 없으면 VITE_* 사용 (잘못된 URL 제외)
    const getEnvVar = (viteKey: string, nextKey: string) => {
      // NEXT_PUBLIC_* 우선
      if (env[nextKey] && env[nextKey].trim() !== '') {
        return env[nextKey];
      }
      // VITE_* 사용 (단, 잘못된 URL이 아닌 경우만)
      if (env[viteKey] && env[viteKey].trim() !== '' && !env[viteKey].includes('npferbxuxocbfnfbpcnz')) {
        return env[viteKey];
      }
      return '';
    };

    const loadedUrl = getEnvVar('VITE_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL');
    const loadedKey = getEnvVar('VITE_SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY');
    const loadedKakaoKey = getEnvVar('VITE_KAKAO_JS_KEY', 'NEXT_PUBLIC_KAKAO_JS_KEY');

    // 디버깅: 개발 모드에서만 로그 출력
    if (mode === 'development') {
      console.log('🔍 [vite.config] 환경변수 로드:');
      console.log('  loadEnv 결과 NEXT_PUBLIC_SUPABASE_URL:', env.NEXT_PUBLIC_SUPABASE_URL || '(없음)');
      console.log('  loadEnv 결과 VITE_SUPABASE_URL:', env.VITE_SUPABASE_URL || '(없음)');
      console.log('  최종 사용 URL:', loadedUrl || '(없음)');
      if (Object.keys(originalProcessEnv).length > 0) {
        console.log('  ⚠️ process.env의 잘못된 값이 제거되었습니다:', Object.keys(originalProcessEnv));
      }
    }

    // 환경변수가 없으면 경고만 출력 (강제 주입하지 않음)
    if (!loadedUrl || !loadedKey) {
      console.warn('⚠️  Supabase 환경변수가 설정되지 않았습니다. .env.local 파일을 확인하세요.');
    }

    // 환경변수를 define에 주입 (있는 경우만)
    const define: Record<string, string> = {};
    if (loadedUrl) {
      define['import.meta.env.VITE_SUPABASE_URL'] = JSON.stringify(loadedUrl);
    }
    if (loadedKey) {
      define['import.meta.env.VITE_SUPABASE_ANON_KEY'] = JSON.stringify(loadedKey);
    }
    if (loadedKakaoKey) {
      define['import.meta.env.VITE_KAKAO_JS_KEY'] = JSON.stringify(loadedKakaoKey);
    }

    return {
      // 프로젝트 루트의 .env.local 파일을 로드
      envDir,
      // Vercel 빌드 시 환경변수를 빌드 타임에 주입
      // process.env의 잘못된 값을 제거한 후 loadEnv로 로드한 값 사용
      // NEXT_PUBLIC_* 값도 VITE_*로 주입하여 env-registry에서 접근 가능하도록 함
      define,
      // Vite 캐시를 루트로 통합
      cacheDir: path.resolve(__dirname, '../../node_modules/.vite'),
    plugins: [react()],
    test: {
      // Vitest 설정: e2e 폴더와 playwright 파일 제외
      exclude: ['node_modules', 'dist', 'e2e', '**/*.e2e.{test,spec}.{js,ts}', '**/playwright.config.ts'],
      environment: 'jsdom',
    },
    optimizeDeps: {
      // esbuild 서비스 안정성을 위한 설정
      esbuildOptions: {
        target: 'es2020',
      },
    },
    esbuild: {
      // esbuild 서비스 안정성 향상
      logOverride: { 'this-is-undefined-in-esm': 'silent' },
    },
    resolve: {
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
      { find: '@services', replacement: path.resolve(__dirname, '../../packages/services') },
      { find: '@hooks', replacement: path.resolve(__dirname, '../../packages/hooks') },
      { find: '@core', replacement: path.resolve(__dirname, '../../packages/core') },
      ],
    },
    server: {
      port: 3001,
    },
    build: {
      // 프로덕션 빌드 시 terser를 사용하여 console.log 제거
      minify: 'terser',
      terserOptions: {
        compress: {
          // 프로덕션 빌드에서 console.log, console.debug 제거
          drop_console: true,
          drop_debugger: true,
          // console.error, console.warn은 유지 (에러 추적용)
          pure_funcs: ['console.log', 'console.debug', 'console.info'],
        },
      },
    },
    };
  } finally {
    // process.env 원복 (다른 프로세스에 영향 주지 않도록)
    Object.keys(originalProcessEnv).forEach(key => {
      if (originalProcessEnv[key] !== undefined) {
        process.env[key] = originalProcessEnv[key];
      }
    });
  }
});
