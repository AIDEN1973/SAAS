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
      // React 모듈 ID 추적
      const normalizedId = id.split('?')[0].replace(/\\/g, '/');
      if (normalizedId.includes('node_modules')) {
        const packageName = normalizedId.split('node_modules/')[1]?.split('/')[0];
        if (packageName === 'react' || packageName === 'react-dom') {
          reactModuleIds.add(normalizedId);
          console.log('[enforce-react-chunk] React module resolved:', normalizedId);
        }
      }
      return null;
    },
    generateBundle(options, bundle) {
      // 빌드 후 검증: vendor 및 lib 청크에 React가 포함되어 있는지 확인
      for (const [fileName, chunk] of Object.entries(bundle)) {
        if (chunk.type === 'chunk') {
          // vendor-1, vendor-2, vendor-3, lib-a-m, lib-n-z, lib-other 청크에서 React 검사
          // react-vendor, react-router-vendor, react-hook-form-vendor는 제외
          const isNonReactVendorChunk = /vendor-[123]-|lib-a-m-|lib-n-z-|lib-other-/.test(fileName);
          const isReactChunk = /react-vendor|react-router-vendor|react-hook-form-vendor/.test(fileName);
          
          if (isNonReactVendorChunk && !isReactChunk) {
            // React 관련 코드가 포함되어 있는지 확인
            const reactIndicators = [
              'forwardRef',
              'createElement',
              'useState',
              'useEffect',
              'useContext',
              'useCallback',
              'useMemo',
              'React.createElement',
              'React.forwardRef',
              'react/jsx-runtime',
              'react-dom/client',
              '__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED'
            ];
            
            const hasReact = reactIndicators.some(indicator => chunk.code.includes(indicator));
            
            if (hasReact) {
              console.error(`\n❌ [enforce-react-chunk] React detected in ${fileName}!`);
              console.error(`   This should not happen. React must be in react-vendor chunk.`);
              console.error(`   React indicators found in chunk.`);
              console.error(`   Tracked React modules:`, Array.from(reactModuleIds).slice(0, 10));
              
              // 청크에 포함된 모듈 출력 (node_modules만)
              const chunkModules = Object.keys(chunk.modules || {})
                .filter(id => id.includes('node_modules'))
                .map(id => {
                  const normalized = id.split('?')[0].replace(/\\/g, '/');
                  const packageName = normalized.split('node_modules/')[1]?.split('/')[0];
                  return packageName;
                })
                .filter((v, i, a) => a.indexOf(v) === i); // unique
              
              console.error(`   Chunk packages (unique):`, chunkModules.slice(0, 20));
              console.error(`   Total packages in chunk:`, chunkModules.length);
              
              throw new Error(`React found in non-React chunk: ${fileName}. Build failed to prevent runtime errors.`);
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
  resolve: {
    alias: [
      // 더 구체적인 패턴을 먼저 매칭 (순서 중요!)
      { find: '@ui-core/react/styles', replacement: path.resolve(__dirname, '../../packages/ui-core/src/styles.css') },
      { find: '@ui-core/react', replacement: path.resolve(__dirname, '../../packages/ui-core/src') },
      { find: '@lib/supabase-client/server', replacement: path.resolve(__dirname, '../../packages/lib/supabase-client/src/server.ts') },
      { find: '@lib/supabase-client/db', replacement: path.resolve(__dirname, '../../packages/lib/supabase-client/src/db.ts') },
      { find: '@lib/supabase-client', replacement: path.resolve(__dirname, '../../packages/lib/supabase-client/src') },
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
            // React 또는 react-dom 패키지인 경우 무조건 react-vendor로
            // scheduler는 React의 내부 의존성이므로 함께 포함
            if (packageName === 'react' || packageName === 'react-dom' || packageName === 'scheduler') {
              console.log('[manualChunks] React core package:', packageName, '-> react-vendor');
              return 'react-vendor';
            }

            // React 내부 패키지들도 react-vendor로
            // object-assign, prop-types 등 React가 사용하는 유틸리티
            if (packageName === 'object-assign' || packageName === 'prop-types') {
              console.log('[manualChunks] React utility package:', packageName, '-> react-vendor');
              return 'react-vendor';
            }

            // 디버깅: React 관련 모듈 로그 출력 (프로덕션 빌드에서도)
            if (normalizedId.includes('react')) {
              const chunkName = (() => {
                // react-router, react-hook-form 등 다른 라이브러리 체크
                if (normalizedId.includes('react-router')) return 'react-router-vendor';
                if (normalizedId.includes('react-hook-form')) return 'react-hook-form-vendor';
                if (normalizedId.includes('lucide-react')) return 'lucide-icons-vendor';
                if (normalizedId.includes('@tanstack/react-query')) return 'tanstack-vendor';

                // 정규식으로 정확하게 매칭
                const reactPattern = /\/react\/|\/react-dom\//;
                if (reactPattern.test(normalizedId)) {
                  return 'react-vendor';
                }

                // 기타 react 포함 모듈은 react-vendor로 (안전장치)
                return 'react-vendor';
              })();

              console.log('[manualChunks] React module:', packageName, '-> chunk:', chunkName, 'id:', normalizedId.substring(normalizedId.indexOf('node_modules')));
              return chunkName;
            }

            // 정규식으로 정확하게 매칭 (정규화된 ID 사용)
            const reactPattern = /[\\/]react[\\/]|[\\/]react-dom[\\/]|^react$|^react-dom$|react[\\/]jsx-runtime|react[\\/]jsx-dev-runtime/;
            if (reactPattern.test(normalizedId)) {
              return 'react-vendor';
            }

            // 추가 안전장치: 'react' 문자열이 포함된 모든 모듈을 react-vendor로
            // 단, react-router, react-hook-form, react-query 등은 제외
            if (normalizedId.includes('react') &&
                !normalizedId.includes('react-router') &&
                !normalizedId.includes('react-hook-form') &&
                !normalizedId.includes('react-query') &&
                !normalizedId.includes('@tanstack/react-query') &&
                !normalizedId.includes('react-select') &&
                !normalizedId.includes('react-dnd') &&
                !normalizedId.includes('react-beautiful-dnd') &&
                !normalizedId.includes('react-window') &&
                !normalizedId.includes('react-virtual')) {
              return 'react-vendor';
            }

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

            // 기타 큰 라이브러리들을 명시적으로 분류
            // vendor-1, 2, 3 대신 명시적인 청크 이름 사용

            // React 관련 패키지는 절대 다른 청크로 가지 않도록
            if (packageName && (packageName === 'react' || packageName === 'react-dom' || packageName.startsWith('react'))) {
              console.log('[manualChunks] React package fallback:', packageName, '-> react-vendor');
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
            if (packageName) {
              // 알파벳 범위로 분배 (안정적)
              const firstChar = packageName.charCodeAt(0);
              let chunkName;
              if (firstChar >= 97 && firstChar <= 109) { // a-m
                chunkName = 'lib-a-m';
              } else if (firstChar >= 110 && firstChar <= 122) { // n-z
                chunkName = 'lib-n-z';
              } else { // @, 숫자 등
                chunkName = 'lib-other';
              }
              
              // n-z 청크로 가는 모듈 로그 (React 문제 디버깅)
              if (chunkName === 'lib-n-z') {
                console.log('[manualChunks] lib-n-z:', packageName);
              }
              
              return chunkName;
            }

            // 패키지 이름을 추출할 수 없는 경우 (절대 react가 아님)
            // React 체크를 한 번 더 수행
            if (normalizedId.includes('/react/') || normalizedId.includes('/react-dom/')) {
              console.log('[manualChunks] React path fallback:', normalizedId.substring(normalizedId.indexOf('node_modules')), '-> react-vendor');
              return 'react-vendor';
            }

            // 기본값: lib-other (vendor-1 대신)
            return 'lib-other';
          }

          // 내부 패키지들
          if (id.includes('@design-system')) {
            return 'design-system';
          }
          if (id.includes('@ui-core')) {
            return 'ui-core';
          }
          if (id.includes('@schema-engine')) {
            return 'schema-engine';
          }
          if (id.includes('@api-sdk')) {
            return 'api-sdk';
          }
          if (id.includes('@hooks')) {
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
    // minify 옵션
    minify: 'esbuild',
  },
  };
});


