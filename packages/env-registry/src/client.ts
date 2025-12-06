import { envClientSchema, type EnvClient } from './schema';

function validateEnvClient(): EnvClient {
  const rawEnv: Record<string, string | undefined> = {};
  
  // Vite 환경 감지 (import.meta.env 사용)
  // Vite에서는 import.meta.env를 통해 환경변수에 접근
  // @ts-ignore - import.meta는 Vite에서만 존재하며, Node.js에서는 SyntaxError 발생
  try {
    // @ts-ignore
    const viteEnv = import.meta.env;
    if (viteEnv) {
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
  }
  
  // Next.js 환경 또는 일반 Node.js 환경
  if (typeof process !== 'undefined' && process.env) {
    // Next.js: NEXT_PUBLIC_* 접두사
    for (const key in process.env) {
      if (key.startsWith('NEXT_PUBLIC_')) {
        rawEnv[key] = process.env[key];
      }
    }
    
    // Vite 환경변수를 NEXT_PUBLIC_로 매핑 (VITE_*가 있는 경우)
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
    
    // Vite 환경인지 확인
    let isVite = false;
    try {
      // @ts-ignore
      isVite = !!import.meta.env;
    } catch (e) {
      // import.meta가 없는 환경
    }
    const envPrefix = isVite ? 'VITE_' : 'NEXT_PUBLIC_';
    
    throw new Error(
      `클라이언트 환경변수 검증 실패:\n${errors}\n\n` +
      (missingVars ? `누락된 필수 환경변수: ${missingVars}\n\n` : '') +
      `필수 클라이언트 환경변수가 누락되었습니다.\n` +
      `프로젝트 루트 디렉토리의 .env.local 파일에 ${envPrefix}SUPABASE_URL과 ${envPrefix}SUPABASE_ANON_KEY를 설정하세요.\n` +
      `(Vite 프로젝트는 VITE_ 접두사, Next.js 프로젝트는 NEXT_PUBLIC_ 접두사 사용)`
    );
  }
  
  return parsed.data;
}

// 애플리케이션 시작 시 한 번만 검증
export const envClient = validateEnvClient();
