import { defineConfig, Plugin, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { visualizer } from 'rollup-plugin-visualizer';
import { readFileSync, existsSync } from 'fs';

// ?œë²„ ?„ìš© ì½”ë“œë¥??´ë¼?´ì–¸??ë²ˆë“¤?ì„œ ?œì™¸?˜ëŠ” ?ŒëŸ¬ê·¸ì¸
function excludeServerCode(): Plugin {
  return {
    name: 'exclude-server-code',
    resolveId(id) {
      // auth-service??service.tsë§??œë²„ ?„ìš©?¼ë¡œ ì²˜ë¦¬
      if (id.includes('auth-service') && (id.includes('/service.ts') || id.includes('/service.js'))) {
        // ?´ë¼?´ì–¸??ë¹Œë“œ?ì„œ??ë¹?ëª¨ë“ˆ ë°˜í™˜
        if (process.env.NODE_ENV !== 'production' || !id.includes('node_modules')) {
          return { id: 'data:text/javascript,export default {}', external: true };
        }
      }
      
      // auth-service??types?€ index???´ë¼?´ì–¸?¸ì—???¬ìš© ê°€??
      if (id.includes('auth-service')) {
        return null; // auth-service??types/index???ˆìš©
      }
      
      // ?œë²„ ?„ìš© ëª¨ë“ˆ??ë¹?ëª¨ë“ˆë¡??€ì²?
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
        // ?´ë¼?´ì–¸??ë¹Œë“œ?ì„œ??ë¹?ëª¨ë“ˆ ë°˜í™˜
        if (process.env.NODE_ENV !== 'production' || !id.includes('node_modules')) {
          return { id: 'data:text/javascript,export default {}', external: true };
        }
      }
      return null;
    },
    load(id) {
      // auth-service??service.tsë§??œë²„ ?„ìš©?¼ë¡œ ì²˜ë¦¬
      if (id.includes('auth-service') && (id.includes('/service.ts') || id.includes('/service.js'))) {
        return 'export default {};';
      }
      
      // auth-service??index.ts???€?…ë§Œ export?˜ë„ë¡??˜ì •
      if (id.includes('auth-service') && (id.includes('/index.ts') || id.includes('/index.js'))) {
        // service.tsë¥?ë¹?ëª¨ë“ˆë¡??€ì²´í•˜ê³?typesë§?export
        return `
          export * from './types';
          // service.ts???œë²„ ?„ìš©?´ë?ë¡??´ë¼?´ì–¸?¸ì—?œëŠ” ?œì™¸
        `;
      }
      
      // auth-service??types???´ë¼?´ì–¸?¸ì—???¬ìš© ê°€??
      if (id.includes('auth-service') && id.includes('/types')) {
        return null; // auth-service??types???ˆìš©
      }
      
      // ?œë²„ ?„ìš© ?Œì¼??ë¹?ëª¨ë“ˆë¡??€ì²?
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
  // ?„ë¡œ?íŠ¸ ë£¨íŠ¸??.env.local ?Œì¼??ë¡œë“œ
  const envDir = path.resolve(__dirname, '../..');
  
  // loadEnv???¤ìŒ ?œì„œë¡?ë¡œë“œ: .env.[mode].local > .env.local > .env.[mode] > .env
  // ?˜ì?ë§?process.envê°€ ?°ì„ ?œìœ„ê°€ ?’ìœ¼ë¯€ë¡? ëª…ì‹œ?ìœ¼ë¡?.env.localë§?ë¡œë“œ
  const env = loadEnv(mode, envDir, '');
  
  // process.env?ì„œ ?˜ëª»??ê°’ì´ ?ˆëŠ”ì§€ ?•ì¸ ë°?ë¬´ì‹œ
  // .env.local ?Œì¼??ê°’ë§Œ ?¬ìš©?˜ë„ë¡?ê°•ì œ
  const envLocalPath = path.join(envDir, '.env.local');
  let envLocal: Record<string, string> = {};
  
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
  
  // .env.local ?Œì¼??ê°’ì„ ?°ì„  ?¬ìš©
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
  
  // ?”ë²„ê¹? ë¡œë“œ???˜ê²½ë³€??ì¶œë ¥
  console.log('?” Vite Config - ?˜ê²½ë³€??ë¡œë“œ:');
  console.log('  loadEnv ê²°ê³¼ VITE_SUPABASE_URL:', env.VITE_SUPABASE_URL || '(?†ìŒ)');
  console.log('  .env.local ?Œì¼ VITE_SUPABASE_URL:', envLocal.VITE_SUPABASE_URL || '(?†ìŒ)');
  console.log('  ìµœì¢… ?¬ìš© VITE_SUPABASE_URL:', finalEnv.VITE_SUPABASE_URL || '(?†ìŒ)');
  console.log('  envDir:', envDir);
  console.log('  mode:', mode);
  
  // ?˜ê²½ë³€?˜ë? define??ì£¼ì… (VITE_ ?‘ë‘?¬ê? ?ˆëŠ” ê²ƒë§Œ)
  const define: Record<string, string> = {};
  
  // ê°•ì œë¡??¬ë°”ë¥?ê°?ì£¼ì… (?˜ê²½ë³€??ë¬¸ì œ ?´ê²°)
  const correctUrl = 'https://xawypsrotrfoyozhrsbb.supabase.co';
  const correctAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhhd3lwc3JvdHJmb3lvemhyc2JiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ5NDQ2MDYsImV4cCI6MjA4MDUyMDYwNn0.gH0THgnxtn2WCroHo2Sn1mtLsFzuq4FXJzqs0Rcfws0';
  
  // ë¡œë“œ???˜ê²½ë³€???•ì¸ (finalEnv ?¬ìš©)
  const loadedUrl = finalEnv.VITE_SUPABASE_URL || finalEnv.NEXT_PUBLIC_SUPABASE_URL;
  const loadedKey = finalEnv.VITE_SUPABASE_ANON_KEY || finalEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  console.log('?” Vite Config - ?˜ê²½ë³€??ë¡œë“œ ê²°ê³¼:');
  console.log('  ë¡œë“œ??URL:', loadedUrl || '(?†ìŒ)');
  console.log('  ?¬ë°”ë¥?URL:', correctUrl);
  console.log('  URL ?¼ì¹˜:', loadedUrl === correctUrl ? '?? : '??);
  
  // ?¬ë°”ë¥?ê°’ìœ¼ë¡?ê°•ì œ ì£¼ì…
  define['import.meta.env.VITE_SUPABASE_URL'] = JSON.stringify(correctUrl);
  define['import.meta.env.VITE_SUPABASE_ANON_KEY'] = JSON.stringify(correctAnonKey);
  console.log('???¬ë°”ë¥?URLë¡?ê°•ì œ ì£¼ì… ?„ë£Œ');
  
  if (env.VITE_KAKAO_JS_KEY) {
    define['import.meta.env.VITE_KAKAO_JS_KEY'] = JSON.stringify(env.VITE_KAKAO_JS_KEY);
  } else if (env.NEXT_PUBLIC_KAKAO_JS_KEY) {
    define['import.meta.env.VITE_KAKAO_JS_KEY'] = JSON.stringify(env.NEXT_PUBLIC_KAKAO_JS_KEY);
  }
  
  if (env.VITE_KAKAO_JS_KEY) {
    define['import.meta.env.VITE_KAKAO_JS_KEY'] = JSON.stringify(env.VITE_KAKAO_JS_KEY);
  } else if (env.NEXT_PUBLIC_KAKAO_JS_KEY) {
    define['import.meta.env.VITE_KAKAO_JS_KEY'] = JSON.stringify(env.NEXT_PUBLIC_KAKAO_JS_KEY);
  }

  return {
  // ?„ë¡œ?íŠ¸ ë£¨íŠ¸??.env.local ?Œì¼??ë¡œë“œ
  envDir,
  // ?˜ê²½ë³€?˜ë? ë¹Œë“œ ?€?„ì— ì£¼ì…
  define,
  plugins: [
    react(),
    excludeServerCode(),
    // Bundle analyzer (ê°œë°œ ?œì—ë§?
    ...(process.env.ANALYZE ? [visualizer({
      open: true,
      filename: 'dist/stats.html',
      gzipSize: true,
      brotliSize: true,
    })] : []),
  ],
  optimizeDeps: {
    exclude: [
      // ?œë²„ ?„ìš© ì½”ë“œ???´ë¼?´ì–¸??ë²ˆë“¤?ì„œ ?œì™¸
      '@lib/supabase-client/server',
      '@env-registry/core/server',
    ],
    include: [
      // xlsx ?¨í‚¤ì§€ë¥?ëª…ì‹œ?ìœ¼ë¡??¬í•¨
      'xlsx',
      // react-hook-form??ëª…ì‹œ?ìœ¼ë¡??¬í•¨ (schema-engine?ì„œ ?¬ìš©)
      'react-hook-form',
    ],
    // ê°•ì œ ?¬ìµœ?í™” (ìºì‹œ ë¬¸ì œ ?´ê²°)
    force: true,
  },
  resolve: {
    alias: [
      // ??êµ¬ì²´?ì¸ ?¨í„´??ë¨¼ì? ë§¤ì¹­ (?œì„œ ì¤‘ìš”!)
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
      { find: '@schema/engine', replacement: path.resolve(__dirname, '../../packages/schema-engine/src') },
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
      // ?œë²„ ?„ìš© ì½”ë“œë¥?externalë¡?ì²˜ë¦¬?˜ì—¬ ?´ë¼?´ì–¸??ë²ˆë“¤?ì„œ ?œì™¸
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

