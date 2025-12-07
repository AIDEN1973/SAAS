// @ts-nocheck
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  // ?�로?�트 루트??.env.local ?�일??로드
  envDir: path.resolve(__dirname, '../..'),
  // Vercel 빌드 ???�경변?��? 빌드 ?�?�에 주입
  define: {
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || ''),
    'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''),
    'import.meta.env.VITE_KAKAO_JS_KEY': JSON.stringify(process.env.VITE_KAKAO_JS_KEY || process.env.NEXT_PUBLIC_KAKAO_JS_KEY || ''),
  },
  plugins: [react()],
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
      { find: '@env-registry', replacement: path.resolve(__dirname, '../../packages/env-registry/src') },
      { find: '@lib', replacement: path.resolve(__dirname, '../../packages/lib') },
      { find: '@design-system/core', replacement: path.resolve(__dirname, '../../packages/design-system/src') },
      { find: '@design-system', replacement: path.resolve(__dirname, '../../packages/design-system/src') },
      { find: '@ui-core', replacement: path.resolve(__dirname, '../../packages/ui-core/src') },
      { find: '@schema/engine', replacement: path.resolve(__dirname, '../../packages/schema-engine/src') },
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
    port: 3003,
  },
});

