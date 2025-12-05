import { envClientSchema, type EnvClient } from './schema';

function validateEnvClient(): EnvClient {
  // 클라이언트 환경에서는 process.env가 빌드타임에 인라인됨
  // Next.js의 경우 NEXT_PUBLIC_*만 클라이언트 번들에 포함
  // ⚠️ 주의: 클라이언트 번들에서 process.env는 빌드 타임에만 존재하며,
  // 런타임(브라우저)에서는 이미 값이 인라인되어 있어 process.env 객체 자체는 undefined일 수 있습니다.
  if (typeof window !== 'undefined' || typeof process === 'undefined') {
    // 브라우저 환경에서는 빌드타임에 이미 값이 인라인되어 있음
    const rawEnv: Record<string, string | undefined> = {};
    if (typeof process !== 'undefined' && process.env) {
      // 빌드타임에 이미 NEXT_PUBLIC_* 값만 포함됨
      // 런타임에서는 process.env가 undefined일 수 있지만, 빌드타임에 인라인된 값은 정상 동작합니다.
      for (const key in process.env) {
        if (key.startsWith('NEXT_PUBLIC_')) {
          rawEnv[key] = process.env[key];
        }
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
      throw new Error(
        `클라이언트 환경변수 검증 실패:\n${errors}\n\n` +
        (missingVars ? `누락된 필수 환경변수: ${missingVars}\n\n` : '') +
        `필수 클라이언트 환경변수가 누락되었습니다.\n` +
        `프로젝트 루트 디렉토리의 .env.local 파일에 NEXT_PUBLIC_SUPABASE_URL과 NEXT_PUBLIC_SUPABASE_ANON_KEY를 설정하세요.`
      );
    }
    return parsed.data;
  }
  
  // 서버 사이드 렌더링 중 (Next.js SSR)
  const rawEnv: Record<string, string | undefined> = {};
  if (process.env) {
    for (const key in process.env) {
      if (key.startsWith('NEXT_PUBLIC_')) {
        rawEnv[key] = process.env[key];
      }
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
    throw new Error(
      `클라이언트 환경변수 검증 실패:\n${errors}\n\n` +
      (missingVars ? `누락된 필수 환경변수: ${missingVars}\n\n` : '') +
      `필수 클라이언트 환경변수가 누락되었습니다.\n` +
      `프로젝트 루트 디렉토리의 .env.local 파일에 NEXT_PUBLIC_SUPABASE_URL과 NEXT_PUBLIC_SUPABASE_ANON_KEY를 설정하세요.`
    );
  }
  
  return parsed.data;
}

// 애플리케이션 시작 시 한 번만 검증
export const envClient = validateEnvClient();
