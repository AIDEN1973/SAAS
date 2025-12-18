import { defineConfig, Plugin, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { visualizer } from 'rollup-plugin-visualizer';
import { readFileSync, existsSync } from 'fs';

// 서버 전용 코드를 클라이언트 번들에서 제외하는 플러그인
function excludeServerCode(): Plugin {
  return {
    name: 'exclude-server-code',
    resolveId(id) {
      // auth-service의 service.ts만 서버 전용으로 처리
      if (id.includes('auth-service') && (id.includes('/service.ts') || id.includes('/service.js'))) {
        // 클라이언트 빌드에서는 빈 모듈 반환
        if (process.env.NODE_ENV !== 'production' || !id.includes('node_modules')) {
          return { id: 'data:text/javascript,export default {}', external: true };
        }
      }

      // auth-service의 types와 index는 클라이언트에서 사용 가능
      if (id.includes('auth-service')) {
        return null; // auth-service의 types/index는 허용
      }

      // 서버 전용 모듈을 빈 모듈로 대체
      if (
        id.includes('/server') ||
        id === '@env-registry/core/server' ||
        id === '@lib/supabase-client/server' ||
        id === '@core/schema-registry' ||
        id.includes('core-schema-registry') ||
        id.includes('/service.ts') ||
        id.includes('/service.js') ||
        id.includes('student-service') ||
        id.includes('attendance-service') ||
        id.includes('class-service') ||
        id.includes('core-tags/src/service') ||
        id.includes('core-party/src/service') ||
        id.includes('industry-academy/src/service') ||
        id === '@core/tags/service' ||
        id === '@core/party/service' ||
        id === '@industry/academy/service' ||
        id.startsWith('@services/')
      ) {
        // 클라이언트 빌드에서는 빈 모듈 반환
        if (process.env.NODE_ENV !== 'production' || !id.includes('node_modules')) {
          return { id: 'data:text/javascript,export default {}', external: true };
        }
      }
      return null;
    },
    load(id) {
      // auth-service의 service.ts만 서버 전용으로 처리
      if (id.includes('auth-service') && (id.includes('/service.ts') || id.includes('/service.js'))) {
        return 'export default {};';
      }

      // auth-service의 index.ts는 타입만 export하도록 수정
      if (id.includes('auth-service') && (id.includes('/index.ts') || id.includes('/index.js'))) {
        // service.ts를 빈 모듈로 대체하고 types만 export
        return `
          export * from './types';
          // service.ts는 서버 전용이므로 클라이언트에서는 제외
        `;
      }

      // auth-service의 types는 클라이언트에서 사용 가능
      if (id.includes('auth-service') && id.includes('/types')) {
        return null; // auth-service의 types는 허용
      }

      // 서버 전용 파일을 빈 모듈로 대체
      if (
        id.includes('/server.ts') ||
        id.includes('/server.js') ||
        id.includes('core-schema-registry') ||
        id.includes('/service.ts') ||
        id.includes('/service.js') ||
        id.includes('student-service') ||
        id.includes('attendance-service') ||
        id.includes('class-service') ||
        (id.includes('core-tags') && id.includes('/service')) ||
        (id.includes('core-party') && id.includes('/service')) ||
        (id.includes('industry-academy') && id.includes('/service'))
      ) {
        return 'export default {};';
      }
      return null;
    },
  };
}

export default defineConfig(({ mode }) => {
  // 프로젝트 루트의 .env.local 파일을 로드
  const envDir = path.resolve(__dirname, '../..');

  // loadEnv는 다음 순서로 로드: .env.[mode].local > .env.local > .env.[mode] > .env
  // 하지만 process.env가 우선순위가 높으므로, 명시적으로 .env.local만 로드
  const env = loadEnv(mode, envDir, '');

  // process.env에서 잘못된 값이 있는지 확인 및 무시
  // .env.local 파일의 값만 사용하도록 강제
  const envLocalPath = path.join(envDir, '.env.local');
  const envLocal: Record<string, string> = {};

  if (existsSync(envLocalPath)) {
    const envLocalContent = readFileSync(envLocalPath, 'utf-8');
    envLocalContent.split('\n').forEach((line: string) => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const match = trimmed.match(/^([^=]+)=(.*)$/);
        if (match) {
          const key = match[1].trim();
          const value = match[2].trim();
          if (key.startsWith('VITE_') || key.startsWith('NEXT_PUBLIC_')) {
            envLocal[key] = value;
          }
        }
      }
    });
  }

  // .env.local 파일의 값을 우선 사용
  const finalEnv = { ...env };
  if (envLocal.VITE_SUPABASE_URL) {
    finalEnv.VITE_SUPABASE_URL = envLocal.VITE_SUPABASE_URL;
  }
  if (envLocal.NEXT_PUBLIC_SUPABASE_URL) {
    finalEnv.NEXT_PUBLIC_SUPABASE_URL = envLocal.NEXT_PUBLIC_SUPABASE_URL;
  }
  if (envLocal.VITE_SUPABASE_ANON_KEY) {
    finalEnv.VITE_SUPABASE_ANON_KEY = envLocal.VITE_SUPABASE_ANON_KEY;
  }
  if (envLocal.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    finalEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY = envLocal.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  }

  // 디버깅: 로드된 환경변수 출력
  console.log('🔍 Vite Config - 환경변수 로드:');
  console.log('  loadEnv 결과 VITE_SUPABASE_URL:', env.VITE_SUPABASE_URL || '(없음)');
  console.log('  .env.local 파일 VITE_SUPABASE_URL:', envLocal.VITE_SUPABASE_URL || '(없음)');
  console.log('  최종 사용 VITE_SUPABASE_URL:', finalEnv.VITE_SUPABASE_URL || '(없음)');
  console.log('  envDir:', envDir);
  console.log('  mode:', mode);

  // 환경변수를 define에 주입 (VITE_ 접두사가 있는 것만)
  const define: Record<string, string> = {};

  // 환경변수 로드 확인 (디버깅용)
  const loadedUrl = finalEnv.VITE_SUPABASE_URL || finalEnv.NEXT_PUBLIC_SUPABASE_URL;
  const loadedKey = finalEnv.VITE_SUPABASE_ANON_KEY || finalEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  console.log('🔍 Vite Config - 환경변수 로드 결과:');
  console.log('  로드된 URL:', loadedUrl || '(없음)');
  console.log('  로드된 Key:', loadedKey ? '***' : '(없음)');

  // 환경변수가 없으면 경고만 출력 (강제 주입하지 않음)
  if (!loadedUrl || !loadedKey) {
    console.warn('⚠️  Supabase 환경변수가 설정되지 않았습니다. .env.local 파일을 확인하세요.');
  }

  // 환경변수를 define에 주입 (있는 경우만)
  if (loadedUrl) {
    define['import.meta.env.VITE_SUPABASE_URL'] = JSON.stringify(loadedUrl);
  }
  if (loadedKey) {
    define['import.meta.env.VITE_SUPABASE_ANON_KEY'] = JSON.stringify(loadedKey);
  }

  if (env.VITE_KAKAO_JS_KEY) {
    define['import.meta.env.VITE_KAKAO_JS_KEY'] = JSON.stringify(env.VITE_KAKAO_JS_KEY);
  } else if (env.NEXT_PUBLIC_KAKAO_JS_KEY) {
    define['import.meta.env.VITE_KAKAO_JS_KEY'] = JSON.stringify(env.NEXT_PUBLIC_KAKAO_JS_KEY);
  }

  return {
  // 프로젝트 루트의 .env.local 파일을 로드
  envDir,
  // 환경변수를 빌드 타임에 주입
  define,
  plugins: [
    react(),
    excludeServerCode(),
    // Bundle analyzer (개발 시에만)
    ...(process.env.ANALYZE ? [visualizer({
      open: true,
      filename: 'dist/stats.html',
      gzipSize: true,
      brotliSize: true,
    })] : []),
  ],
  optimizeDeps: {
    exclude: [
      // 서버 전용 코드는 클라이언트 번들에서 제외
      '@lib/supabase-client/server',
      '@env-registry/core/server',
    ],
    include: [
      // xlsx 패키지를 명시적으로 포함
      'xlsx',
      // react-hook-form을 명시적으로 포함 (schema-engine에서 사용)
      'react-hook-form',
    ],
    // 강제 재최적화 (캐시 문제 해결)
    force: true,
  },
  resolve: {
    alias: [
      // 더 구체적인 패턴을 먼저 매칭 (순서 중요!)
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
      { find: '@core/pii-utils', replacement: path.resolve(__dirname, '../../packages/core/pii-utils/src') },
      { find: '@core/tags/service', replacement: path.resolve(__dirname, '../../packages/core/core-tags/src/service.ts') },
      { find: '@core/tags', replacement: path.resolve(__dirname, '../../packages/core/core-tags/src') },
      { find: '@core/party/service', replacement: path.resolve(__dirname, '../../packages/core/core-party/src/service.ts') },
      { find: '@core/party', replacement: path.resolve(__dirname, '../../packages/core/core-party/src') },
      { find: '@core/schema-registry', replacement: path.resolve(__dirname, '../../packages/core/core-schema-registry/src') },
      { find: '@env-registry', replacement: path.resolve(__dirname, '../../packages/env-registry/src') },
      { find: '@lib', replacement: path.resolve(__dirname, '../../packages/lib') },
      { find: '@design-system/core', replacement: path.resolve(__dirname, '../../packages/design-system/src') },
      { find: '@design-system', replacement: path.resolve(__dirname, '../../packages/design-system/src') },
      { find: '@ui-core', replacement: path.resolve(__dirname, '../../packages/ui-core/src') },
      { find: '@schema-engine', replacement: path.resolve(__dirname, '../../packages/schema-engine/src') },
      { find: '@api-sdk/core', replacement: path.resolve(__dirname, '../../packages/api-sdk/src') },
      { find: '@api-sdk', replacement: path.resolve(__dirname, '../../packages/api-sdk/src') },
      { find: '@industry/academy/service', replacement: path.resolve(__dirname, '../../packages/industry/industry-academy/src/service.ts') },
      { find: '@industry/academy', replacement: path.resolve(__dirname, '../../packages/industry/industry-academy/src') },
      { find: '@industry', replacement: path.resolve(__dirname, '../../packages/industry') },
      { find: '@services', replacement: path.resolve(__dirname, '../../packages/services') },
      { find: '@hooks', replacement: path.resolve(__dirname, '../../packages/hooks') },
      { find: '@core', replacement: path.resolve(__dirname, '../../packages/core') },
    ],
  },
  server: {
    port: 3000,
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      // 서버 전용 코드를 external로 처리하여 클라이언트 번들에서 제외
      external: [
        '@env-registry/core/server',
        '@lib/supabase-client/server',
        '@services/student-service',
        '@industry/academy/service',
        '@core/tags',
      ],
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
  };
});

