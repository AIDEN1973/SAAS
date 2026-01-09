import { defineConfig, Plugin, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { visualizer } from 'rollup-plugin-visualizer';
import { readFileSync, existsSync } from 'fs';
import type { Plugin as RollupPlugin } from 'rollup';

// React를 강제로 react-vendor 청크로 분리하는 플러그인
function enforceReactChunk(): RollupPlugin {
  const reactModuleIds = new Set<string>();

  return {
    name: 'enforce-react-chunk',
    resolveId(id) {
      // React 모듈 ID 추적 (디버깅용, 프로덕션에서는 로그 최소화)
      const normalizedId = id.split('?')[0].replace(/\\/g, '/');
      if (normalizedId.includes('node_modules')) {
        const packageName = normalizedId.split('node_modules/')[1]?.split('/')[0];
        if (packageName === 'react' || packageName === 'react-dom') {
          reactModuleIds.add(normalizedId);
        }
      }
      return null;
    },
    generateBundle(options, bundle) {
      // 빌드 후 검증: vendor 및 lib 청크에 React가 포함되어 있는지 확인
      for (const [fileName, chunk] of Object.entries(bundle)) {
        if (chunk.type === 'chunk') {
          // 모든 vendor 및 lib 청크에서 React 검사 (react-vendor 제외)
          const isNonReactVendorChunk = /vendor-[123]-|lib-a-z-|lib-a-m-|lib-n-z-|lib-other-|lib-scoped-|lib-utils-/.test(fileName);
          const isReactChunk = /react-vendor|react-router-vendor|react-hook-form-vendor|radix-ui-vendor|charts-vendor|redux-vendor/.test(fileName);

          if (isNonReactVendorChunk && !isReactChunk) {
            // 실제로 React 모듈이 포함되어 있는지 확인 (더 정확한 검사)
            const chunkModuleIds = Object.keys(chunk.modules || {});
            const hasReactModule = chunkModuleIds.some(id => {
              const normalized = id.split('?')[0].replace(/\\/g, '/');
              return normalized.includes('/react/') ||
                     normalized.includes('/react-dom/') ||
                     normalized.includes('/react-is/') ||
                     normalized.includes('/scheduler/') ||
                     normalized.includes('/use-sync-external-store/') ||
                     normalized.includes('node_modules/react') ||
                     normalized.includes('node_modules/react-dom');
            });

            // React 모듈이 실제로 포함되어 있는 경우에만 오류
            if (hasReactModule) {
              console.error(`\n[enforce-react-chunk] React module detected in ${fileName}!`);
              console.error(`   This should not happen. React must be in react-vendor chunk.`);
              console.error(`   Tracked React modules:`, Array.from(reactModuleIds).slice(0, 10));

              // 청크에 포함된 React 모듈 찾기
              const reactModulesInChunk = chunkModuleIds
                .filter(id => {
                  const normalized = id.split('?')[0].replace(/\\/g, '/');
                  return normalized.includes('/react/') ||
                         normalized.includes('/react-dom/') ||
                         normalized.includes('/react-is/') ||
                         normalized.includes('/scheduler/') ||
                         normalized.includes('/use-sync-external-store/');
                })
                .map(id => {
                  const normalized = id.split('?')[0].replace(/\\/g, '/');
                  return normalized.substring(normalized.indexOf('node_modules'));
                });

              console.error(`   React modules in chunk:`, reactModulesInChunk.slice(0, 10));

              // 청크에 포함된 모듈 출력 (node_modules만)
              const chunkModules = chunkModuleIds
                .filter(id => id.includes('node_modules'))
                .map(id => {
                  const normalized = id.split('?')[0].replace(/\\/g, '/');
                  const packageName = normalized.split('node_modules/')[1]?.split('/')[0];
                  return packageName;
                })
                .filter((v, i, a) => a.indexOf(v) === i); // unique

              console.error(`   Chunk packages (unique):`, chunkModules.slice(0, 20));
              console.error(`   Total packages in chunk:`, chunkModules.length);

              // 빌드 실패로 변경하여 React가 잘못된 청크에 포함되는 것을 방지
              throw new Error(`React module found in non-React chunk: ${fileName}. Build failed to prevent runtime errors. React modules: ${reactModulesInChunk.slice(0, 5).join(', ')}`);
            }
          }
        }
      }
    },
  };
}

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
        id === '@env-registry/server' ||
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
        id.includes('industry-academy/src/seed') ||
        id === '@core/tags/service' ||
        id === '@core/party/service' ||
        id === '@industry/academy/service' ||
        id === '@industry/academy/seed' ||
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
        (id.includes('industry-academy') && (id.includes('/service') || id.includes('/seed')))
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

  // 환경변수를 define에 주입 (VITE_ 접두사가 있는 것만)
  const define: Record<string, string> = {};

  // 환경변수 로드 확인
  const loadedUrl = finalEnv.VITE_SUPABASE_URL || finalEnv.NEXT_PUBLIC_SUPABASE_URL;
  const loadedKey = finalEnv.VITE_SUPABASE_ANON_KEY || finalEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // 환경변수가 없으면 경고 출력
  if (!loadedUrl || !loadedKey) {
    console.warn('⚠️ Supabase 환경변수가 설정되지 않았습니다. .env.local 파일을 확인하세요.');
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
  // Vite 캐시를 루트로 통합
  cacheDir: path.resolve(__dirname, '../../node_modules/.vite'),
  // 프로덕션 빌드에서 정적 자산 경로 문제 해결
  base: '/',
  plugins: [
    react(),
    excludeServerCode(),
    // React 청크 강제 분리 플러그인
    enforceReactChunk(),
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
      '@env-registry/server',
      '@env-registry/core/server',
      '@industry/academy/seed',
    ],
    include: [
      // React를 명시적으로 포함 (초기화 순서 보장)
      'react',
      'react-dom',
      'react/jsx-runtime',
      // xlsx 패키지를 명시적으로 포함
      'xlsx',
      // react-hook-form을 명시적으로 포함 (schema-engine에서 사용)
      'react-hook-form',
    ],
    // 강제 재최적화 (캐시 문제 해결)
    force: true,
    // ESBuild 옵션
    esbuildOptions: {
      // React를 전역으로 처리하지 않도록
      define: {
        global: 'globalThis',
      },
    },
  },
  css: {
    // CSS 파일이 제대로 처리되도록 설정
    devSourcemap: true,
    // CSS 모듈 처리
    modules: {
      localsConvention: 'camelCase',
    },
  },
  resolve: {
    alias: [
      // 더 구체적인 패턴을 먼저 매칭 (순서 중요!)
      { find: '@ui-core/react/styles', replacement: path.resolve(__dirname, '../../packages/ui-core/src/styles.css') },
      { find: '@ui-core/react', replacement: path.resolve(__dirname, '../../packages/ui-core/src') },
      { find: '@lib/supabase-client/server', replacement: path.resolve(__dirname, '../../packages/lib/supabase-client/src/server.ts') },
      { find: '@lib/supabase-client/db', replacement: path.resolve(__dirname, '../../packages/lib/supabase-client/src/db.ts') },
      { find: '@lib/supabase-client', replacement: path.resolve(__dirname, '../../packages/lib/supabase-client/src') },
      { find: '@lib/kakao-address', replacement: path.resolve(__dirname, '../../packages/lib/kakao-address/src') },
      { find: '@env-registry/server', replacement: path.resolve(__dirname, '../../packages/env-registry/src/server.ts') },
      { find: '@env-registry/client', replacement: path.resolve(__dirname, '../../packages/env-registry/src/client.ts') },
      { find: '@env-registry/common', replacement: path.resolve(__dirname, '../../packages/env-registry/src/common.ts') },
      { find: '@env-registry', replacement: path.resolve(__dirname, '../../packages/env-registry/src') },
      // 하위 호환성을 위한 deprecated 경로 (점진적 제거 예정)
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
      { find: '@industry/registry', replacement: path.resolve(__dirname, '../../packages/industry/industry-registry.ts') },
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
    // CSS 코드 스플리팅 설정
    // true: CSS를 청크별로 분리 (기본값, 각 청크와 함께 로드되어 타이밍 문제 방지)
    // false: CSS를 하나의 파일로 합침 (CSS 로딩 타이밍 문제 발생 가능)
    cssCodeSplit: true, // 기본값으로 복원 - CSS가 각 청크와 함께 로드되도록
    // CSS 파일을 별도 파일로 추출
    cssMinify: true,
    // CSS 파일이 제대로 포함되도록 명시적으로 설정
    assetsInlineLimit: 0, // CSS를 인라인하지 않고 별도 파일로 유지
    commonjsOptions: {
      // 순환 의존성 문제 해결을 위한 설정
      include: [/node_modules/],
      transformMixedEsModules: true,
      // CommonJS 모듈도 ES 모듈로 변환하여 일관된 처리 보장
      strictRequires: true,
    },
    rollupOptions: {
      // 서버 전용 코드를 external로 처리하여 클라이언트 번들에서 제외
      external: [
        '@env-registry/server',
        '@env-registry/core/server',
        '@lib/supabase-client/server',
        '@services/student-service',
        '@industry/academy/service',
        '@core/tags',
      ],
      output: {
        // 순환 의존성 문제 해결을 위한 설정
        format: 'es',
        // 모듈 초기화 순서 보장
        preserveModules: false,
        // 청크 로딩 순서 보장
        chunkFileNames: (chunkInfo) => {
          // React vendor는 가장 먼저 로드되도록
          if (chunkInfo.name === 'react-vendor') {
            return 'assets/react-vendor-[hash].js';
          }
          return 'assets/[name]-[hash].js';
        },
        // 청크 간 의존성 순서 보장
        entryFileNames: 'assets/[name]-[hash].js',
        manualChunks: (id) => {
          // CommonJS 모듈 쿼리 파라미터 제거 (정규화)
          // Windows와 Unix 경로 모두 처리
          let normalizedId = id.split('?')[0];
          // 경로 정규화 (Windows 경로를 Unix 스타일로)
          normalizedId = normalizedId.replace(/\\/g, '/');

          // node_modules의 큰 라이브러리들을 별도 청크로 분리
          if (normalizedId.includes('node_modules')) {
            // 패키지 이름을 먼저 추출
            const packageName = normalizedId.split('node_modules/')[1]?.split('/')[0];

            // ===== React 관련 모듈을 최우선으로 처리 (다른 로직보다 먼저) =====
            // React의 모든 내부 의존성과 관련 패키지를 명시적으로 나열
            const reactRelatedPackages = [
              'react',
              'react-dom',
              'react-is',                 // React 타입 체크 유틸리티
              'scheduler',                // React의 내부 스케줄러
              'object-assign',            // React 유틸리티
              'prop-types',               // React prop 검증
              'loose-envify',             // React 빌드 도구
              'js-tokens',                // React 파서
              'regenerator-runtime',      // React async 지원
              'use-sync-external-store',  // React 18의 내부 훅 (useSyncExternalStore)
            ];

            if (reactRelatedPackages.includes(packageName)) {
              // 프로덕션 빌드에서는 로그 출력하지 않음
              return 'react-vendor';
            }

            // React 패키지 내부 경로 체크 (통합)
            const reactPathPatterns = [
              '/react/',
              '/react-dom/',
              '/react-is/',
              '/scheduler/',
              '/use-sync-external-store/'
            ];

            if (reactPathPatterns.some(pattern => normalizedId.includes(pattern))) {
              // 프로덕션 빌드에서는 로그 출력하지 않음
              return 'react-vendor';
            }

            // React를 사용하는 다른 라이브러리들 (별도 청크로 분리)
            if (normalizedId.includes('react')) {
              // react-router, react-hook-form 등은 별도 청크로
              if (normalizedId.includes('react-router')) return 'react-router-vendor';
              if (normalizedId.includes('react-hook-form')) return 'react-hook-form-vendor';
              if (normalizedId.includes('lucide-react')) return 'lucide-icons-vendor';
              if (normalizedId.includes('@tanstack/react-query')) return 'tanstack-vendor';

              // 제외 목록에 없는 react 포함 모듈은 react-vendor로
              const excludedReactLibs = [
                'react-router',
                'react-hook-form',
                'react-query',
                '@tanstack/react-query',
                'react-select',
                'react-dnd',
                'react-beautiful-dnd',
                'react-window',
                'react-virtual',
                'phosphor-react', // 아이콘 라이브러리 - 별도 처리
              ];

              if (!excludedReactLibs.some(lib => normalizedId.includes(lib))) {
                // 프로덕션 빌드에서는 로그 출력하지 않음
                return 'react-vendor';
              }
            }

            // TanStack Query 관련 (위에서 react 포함 체크 후 처리)

            // React Router
            if (normalizedId.includes('react-router')) {
              return 'react-router-vendor';
            }
            // TanStack Query 관련
            if (normalizedId.includes('@tanstack')) {
              return 'tanstack-vendor';
            }
            // React Hook Form
            if (normalizedId.includes('react-hook-form')) {
              return 'react-hook-form-vendor';
            }
            // Lucide icons
            if (normalizedId.includes('lucide-react')) {
              return 'lucide-icons-vendor';
            }
            // Phosphor icons (React 아이콘 라이브러리)
            if (normalizedId.includes('phosphor-react')) {
              return 'lucide-icons-vendor'; // 아이콘 라이브러리는 함께 묶음
            }
            // Radix UI
            if (normalizedId.includes('radix-ui') || normalizedId.includes('@radix-ui')) {
              return 'radix-ui-vendor';
            }
            // date-fns 같은 유틸리티
            if (normalizedId.includes('date-fns') || normalizedId.includes('dayjs') || normalizedId.includes('moment')) {
              return 'date-vendor';
            }
            // Zod (validation library)
            if (normalizedId.includes('zod')) {
              return 'zod-vendor';
            }
            // Recharts (React 차트 라이브러리 - 별도 청크로 분리)
            // recharts는 React를 peer dependency로 사용하므로 charts-vendor로 분리
            if (normalizedId.includes('recharts')) {
              return 'charts-vendor';
            }
            // Redux (상태 관리 - React와 함께 사용되지만 별도 청크로)
            if (normalizedId.includes('redux') || normalizedId.includes('reselect')) {
              return 'redux-vendor';
            }
            // Victory (차트 라이브러리 - React 사용)
            if (normalizedId.includes('victory')) {
              return 'charts-vendor';
            }

            // 기타 큰 라이브러리들을 명시적으로 분류
            // vendor-1, 2, 3 대신 명시적인 청크 이름 사용

            // React 관련 패키지 최종 안전장치 (위의 모든 체크를 통과한 경우)
            if (packageName && (packageName === 'react' || packageName === 'react-dom' ||
                (packageName.startsWith('react') && !packageName.includes('react-router') &&
                 !packageName.includes('react-hook-form') && !packageName.includes('phosphor-react')))) {
              // 프로덕션 빌드에서는 로그 출력하지 않음
              return 'react-vendor';
            }

            // Supabase
            if (packageName && packageName.startsWith('@supabase')) {
              return 'supabase-vendor';
            }

            // D3 (for recharts)
            if (packageName && packageName.startsWith('d3-')) {
              return 'charts-vendor';
            }

            // 기타 라이브러리들을 명시적인 청크로
            // lib-a-z를 제거하고 각 라이브러리를 명시적으로 분류
            if (packageName) {
              // 큰 유틸리티 라이브러리들을 별도 청크로 분리 (lib-utils 크기 감소)
              if (packageName === 'xlsx') {
                return 'lib-xlsx'; // 큰 라이브러리는 별도 청크로
              }
              if (packageName === 'iceberg-js') {
                return 'lib-iceberg'; // 큰 라이브러리는 별도 청크로
              }
              // 작은 유틸리티 라이브러리들
              if (packageName === 'clsx') {
                return 'lib-utils';
              }
              if (packageName === 'immer') {
                return 'lib-utils';
              }
              if (packageName === 'tslib') {
                return 'lib-utils';
              }
              if (packageName === 'es-toolkit' || packageName === 'internmap' || packageName === 'decimal.js-light' || packageName === 'eventemitter3' || packageName === 'tiny-invariant') {
                return 'lib-utils';
              }

              const firstChar = packageName.charCodeAt(0);

              // @로 시작하는 스코프 패키지들
              if (packageName.startsWith('@')) {
                // @radix-ui는 별도 청크로
                if (packageName.startsWith('@radix-ui')) {
                  return 'radix-ui-vendor';
                }
                // @tanstack는 이미 위에서 처리됨
                // 기타 @ 패키지는 lib-scoped로
                return 'lib-scoped';
              }

              // 알파벳 범위로 분배 (lib-a-z 제거)
              if (firstChar >= 97 && firstChar <= 109) { // a-m
                return 'lib-a-m';
              } else if (firstChar >= 110 && firstChar <= 122) { // n-z
                return 'lib-n-z';
              } else { // 숫자 등
                return 'lib-other';
              }
            }

            // 패키지 이름을 추출할 수 없는 경우 최종 React 경로 체크
            if (normalizedId.includes('/react/') || normalizedId.includes('/react-dom/')) {
              // 프로덕션 빌드에서는 로그 출력하지 않음
              return 'react-vendor';
            }

            // 기본값: lib-other (vendor-1 대신)
            return 'lib-other';
          }

          // 내부 패키지들을 더 작은 청크로 분리 (초기 로드 번들 크기 감소)
          if (id.includes('@design-system')) {
            return 'design-system';
          }
          // @ui-core를 더 작은 청크로 분리
          if (id.includes('@ui-core')) {
            // 큰 컴포넌트들은 별도 청크로 (초기 로드에서 제외)
            if (id.includes('ChatOpsPanel') || id.includes('AILayerMenu') || id.includes('AppLayout')) {
              return 'ui-core-components';
            }
            // 스타일 파일은 별도 청크로
            if (id.includes('styles') || id.includes('index.css')) {
              return 'ui-core-styles';
            }
            return 'ui-core';
          }
          if (id.includes('@schema-engine')) {
            return 'schema-engine';
          }
          if (id.includes('@api-sdk')) {
            return 'api-sdk';
          }
          // @hooks를 더 작은 청크로 분리
          if (id.includes('@hooks')) {
            // 큰 hook들은 별도 청크로 (초기 로드에서 제외)
            if (id.includes('use-chatops') || id.includes('use-execution-audit')) {
              return 'hooks-chatops';
            }
            return 'hooks';
          }
          if (id.includes('@core')) {
            return 'core';
          }
          if (id.includes('@services')) {
            return 'services';
          }

          // 페이지별 코드 스플리팅은 React.lazy로 처리되므로 여기서는 제외
          return null;
        },
      },
      // 순환 의존성 감지 활성화
      onwarn(warning, warn) {
        // 순환 의존성 경고는 무시하지 않고 로그만 출력
        if (warning.code === 'CIRCULAR_DEPENDENCY') {
          console.warn('Circular dependency detected:', warning.message);
        }
        warn(warning);
      },
    },
    // Chunk size warning limit (500KB)
    chunkSizeWarningLimit: 500,
    // 소스맵 생성 (디버깅용, 프로덕션에서는 false로 설정 가능)
    sourcemap: false,
    // minify 옵션: 프로덕션 빌드 시 terser를 사용하여 console.log 제거
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
});
