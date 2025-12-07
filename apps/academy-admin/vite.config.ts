import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { visualizer } from 'rollup-plugin-visualizer';

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

export default defineConfig({
  // 프로젝트 루트의 .env.local 파일을 로드
  envDir: path.resolve(__dirname, '../..'),
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
      { find: '@core/tags/service', replacement: path.resolve(__dirname, '../../packages/core/core-tags/src/service.ts') },
      { find: '@core/tags', replacement: path.resolve(__dirname, '../../packages/core/core-tags/src') },
      { find: '@core/party/service', replacement: path.resolve(__dirname, '../../packages/core/core-party/src/service.ts') },
      { find: '@core/party', replacement: path.resolve(__dirname, '../../packages/core/core-party/src') },
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
});

