import { envClientSchema, type EnvClient } from './schema';

// Vite 환경변수 타입 정의 (Vite가 없는 환경에서도 타입 체크 통과)
interface ImportMetaEnv {
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
  VITE_KAKAO_JS_KEY?: string;
  [key: string]: any;
}

function validateEnvClient(): EnvClient {
  const rawEnv: Record<string, string | undefined> = {};
  
  // Vite 환경 감지 (import.meta.env 사용)
  // Vite에서는 import.meta.env를 통해 환경변수에 접근
  // 프로덕션 빌드에서는 빌드 타임에 주입되므로 항상 접근 가능해야 함
  let isVite = false;
  try {
    // @ts-ignore - import.meta는 Vite에서만 존재하며, 타입 정의가 완벽하지 않을 수 있음
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const metaEnv = import.meta.env;
    if (metaEnv) {
      isVite = true;
      const viteEnv = metaEnv as ImportMetaEnv;
      
      // Vite: VITE_* 접두사 사용
      // VITE_ 접두사를 NEXT_PUBLIC_로 매핑 (스키마 호환성)
      if (viteEnv.VITE_SUPABASE_URL) {
        rawEnv.NEXT_PUBLIC_SUPABASE_URL = viteEnv.VITE_SUPABASE_URL;
      }
      if (viteEnv.VITE_SUPABASE_ANON_KEY) {
        rawEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY = viteEnv.VITE_SUPABASE_ANON_KEY;
      }
      if (viteEnv.VITE_KAKAO_JS_KEY) {
        rawEnv.NEXT_PUBLIC_KAKAO_JS_KEY = viteEnv.VITE_KAKAO_JS_KEY;
      }
    }
  } catch (e) {
    // import.meta가 없는 환경 (Node.js 등) - 정상적인 동작
    isVite = false;
  }
  
  // Next.js 환경 또는 일반 Node.js 환경 (또는 Vite 프로덕션에서 process.env도 체크)
  if (typeof process !== 'undefined' && process.env) {
    // Next.js: NEXT_PUBLIC_* 접두사
    for (const key in process.env) {
      if (key.startsWith('NEXT_PUBLIC_')) {
        rawEnv[key] = process.env[key];
      }
    }
    
    // Vite 환경변수를 NEXT_PUBLIC_로 매핑 (VITE_*가 있는 경우)
    // 프로덕션 빌드에서 import.meta.env가 작동하지 않는 경우를 대비
    if (process.env.VITE_SUPABASE_URL && !rawEnv.NEXT_PUBLIC_SUPABASE_URL) {
      rawEnv.NEXT_PUBLIC_SUPABASE_URL = process.env.VITE_SUPABASE_URL;
    }
    if (process.env.VITE_SUPABASE_ANON_KEY && !rawEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      rawEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
    }
    if (process.env.VITE_KAKAO_JS_KEY && !rawEnv.NEXT_PUBLIC_KAKAO_JS_KEY) {
      rawEnv.NEXT_PUBLIC_KAKAO_JS_KEY = process.env.VITE_KAKAO_JS_KEY;
    }
  }
  
  const parsed = envClientSchema.safeParse(rawEnv);
  
  if (!parsed.success) {
    const errors = parsed.error.errors.map(e => 
      `${e.path.join('.')}: ${e.message}`
    ).join('\n');
    const missingVars = parsed.error.errors
      .filter(e => e.code === 'invalid_type' && e.received === 'undefined')
      .map(e => e.path.join('.'))
      .join(', ');
    
    // Vite 환경인지 확인 (위에서 이미 확인함)
    const envPrefix = isVite ? 'VITE_' : 'NEXT_PUBLIC_';
    
    // 디버깅 정보 수집
    const debugInfo: string[] = [];
    try {
      // @ts-ignore
      const metaEnv = import.meta.env;
      if (metaEnv) {
        debugInfo.push(`import.meta.env.VITE_SUPABASE_URL: ${metaEnv.VITE_SUPABASE_URL ? '설정됨' : '미설정'}`);
        debugInfo.push(`import.meta.env.VITE_SUPABASE_ANON_KEY: ${metaEnv.VITE_SUPABASE_ANON_KEY ? '설정됨' : '미설정'}`);
      }
    } catch (e) {
      debugInfo.push('import.meta.env 접근 불가');
    }
    if (typeof process !== 'undefined' && process.env) {
      debugInfo.push(`process.env.VITE_SUPABASE_URL: ${process.env.VITE_SUPABASE_URL ? '설정됨' : '미설정'}`);
      debugInfo.push(`process.env.VITE_SUPABASE_ANON_KEY: ${process.env.VITE_SUPABASE_ANON_KEY ? '설정됨' : '미설정'}`);
      debugInfo.push(`process.env.NEXT_PUBLIC_SUPABASE_URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL ? '설정됨' : '미설정'}`);
      debugInfo.push(`process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY: ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '설정됨' : '미설정'}`);
    }
    
    throw new Error(
      `클라이언트 환경변수 검증 실패:\n${errors}\n\n` +
      (missingVars ? `누락된 필수 환경변수: ${missingVars}\n\n` : '') +
      `필수 클라이언트 환경변수가 누락되었습니다.\n\n` +
      `환경변수 설정 방법:\n` +
      `1. 로컬 개발: 프로젝트 루트 디렉토리의 .env.local 파일에 ${envPrefix}SUPABASE_URL과 ${envPrefix}SUPABASE_ANON_KEY를 설정하세요.\n` +
      `2. Vercel 배포: Vercel 대시보드 > 프로젝트 설정 > Environment Variables에서 ${envPrefix}SUPABASE_URL과 ${envPrefix}SUPABASE_ANON_KEY를 설정하세요.\n` +
      `   (Vite 프로젝트는 VITE_ 접두사, Next.js 프로젝트는 NEXT_PUBLIC_ 접두사 사용)\n\n` +
      (debugInfo.length > 0 ? `디버깅 정보:\n${debugInfo.join('\n')}\n\n` : '') +
      `참고: Vite 프로덕션 빌드에서는 빌드 타임에 환경변수가 주입되어야 합니다.`
    );
  }
  
  return parsed.data;
}

// 애플리케이션 시작 시 한 번만 검증
export const envClient = validateEnvClient();
