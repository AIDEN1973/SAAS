import { envClientSchema, type EnvClient } from './schema';

// Vite 환경변수 타입 정의 (Vite가 있는 환경에서만 체크 가능)
interface ImportMetaEnv {
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
  VITE_KAKAO_JS_KEY?: string;
  [key: string]: unknown;
}

function validateEnvClient(): EnvClient {
  const rawEnv: Record<string, string | undefined> = {};

  // Vite 환경 감지 (import.meta.env 사용)
  // Vite에서는 import.meta.env를 통해 환경변수에 접근
  // 프로덕션 빌드에서는 빌드 타임에 주입되어 접근 가능합니다
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
      // VITE_ 접두사를 NEXT_PUBLIC_로 매핑 (키 변환)
      // 빈 문자열 체크 (define 옵션으로 주입된 경우 빈 문자열일 수 있음)
      // 잘못된 URL 체크: npferbxuxocbfnfbpcnz는 잘못된 프로젝트 URL이므로 무시
      // 값이 이미 설정되지 않은 경우에만 설정 (NEXT_PUBLIC_* 우선)
      // vite.config.ts에서 NEXT_PUBLIC_SUPABASE_URL을 VITE_SUPABASE_URL로 주입했을 수 있으므로,
      // 잘못된 URL이 아닌 경우 무조건 매핑 (vite.config.ts에서 이미 필터링됨)
      if (!rawEnv.NEXT_PUBLIC_SUPABASE_URL && viteEnv.VITE_SUPABASE_URL && viteEnv.VITE_SUPABASE_URL.trim() !== '') {
        // vite.config.ts에서 이미 필터링했으므로, 여기서는 단순히 매핑만 수행
        // 단, 명시적으로 잘못된 URL인 경우만 제외
        if (!viteEnv.VITE_SUPABASE_URL.includes('npferbxuxocbfnfbpcnz')) {
          rawEnv.NEXT_PUBLIC_SUPABASE_URL = viteEnv.VITE_SUPABASE_URL;
        }
      }
      if (!rawEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY && viteEnv.VITE_SUPABASE_ANON_KEY && viteEnv.VITE_SUPABASE_ANON_KEY.trim() !== '') {
        rawEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY = viteEnv.VITE_SUPABASE_ANON_KEY;
      }
      if (!rawEnv.NEXT_PUBLIC_KAKAO_JS_KEY && viteEnv.VITE_KAKAO_JS_KEY && viteEnv.VITE_KAKAO_JS_KEY.trim() !== '') {
        rawEnv.NEXT_PUBLIC_KAKAO_JS_KEY = viteEnv.VITE_KAKAO_JS_KEY;
      }
    }
  } catch (e) {
    // import.meta가 없는 환경 (Node.js 등 - 정상적인 동작)
    isVite = false;
  }

  // Next.js 환경 또는 일반 Node.js 환경 (또는 Vite 프로덕션에서 process.env로 체크)
  if (typeof process !== 'undefined' && process.env) {
    // Next.js: NEXT_PUBLIC_* 접두사
    for (const key in process.env) {
      if (key.startsWith('NEXT_PUBLIC_')) {
        rawEnv[key] = process.env[key];
      }
    }

    // Vite 환경변수를 NEXT_PUBLIC_로 매핑 (VITE_*가 있는 경우)
    // 프로덕션 빌드에서 import.meta.env가 동적으로 접근되지 않는 경우 대비
    // 잘못된 URL 체크: npferbxuxocbfnfbpcnz는 잘못된 프로젝트 URL이므로 무시
    if (process.env.VITE_SUPABASE_URL && !rawEnv.NEXT_PUBLIC_SUPABASE_URL && !process.env.VITE_SUPABASE_URL.includes('npferbxuxocbfnfbpcnz')) {
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

    // Vite 환경인지 확인 (에러 메시지에 반영)
    const envPrefix = isVite ? 'VITE_' : 'NEXT_PUBLIC_';

    // 디버깅 정보 수집
    const debugInfo: string[] = [];
    try {
      // @ts-ignore
      const metaEnv = import.meta.env;
      if (metaEnv) {
        const viteUrl = metaEnv.VITE_SUPABASE_URL;
        const viteKey = metaEnv.VITE_SUPABASE_ANON_KEY;
        debugInfo.push(`import.meta.env.VITE_SUPABASE_URL: ${viteUrl ? (viteUrl.includes('npferbxuxocbfnfbpcnz') ? '설정됨 (잘못된 URL)' : '설정됨') : '미설정'}`);
        if (viteUrl) {
          debugInfo.push(`  값: ${viteUrl.substring(0, 50)}...`);
        }
        debugInfo.push(`import.meta.env.VITE_SUPABASE_ANON_KEY: ${viteKey ? '설정됨' : '미설정'}`);
        debugInfo.push(`rawEnv.NEXT_PUBLIC_SUPABASE_URL: ${rawEnv.NEXT_PUBLIC_SUPABASE_URL ? '설정됨' : '미설정'}`);
        if (rawEnv.NEXT_PUBLIC_SUPABASE_URL) {
          debugInfo.push(`  값: ${rawEnv.NEXT_PUBLIC_SUPABASE_URL.substring(0, 50)}...`);
        }
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
