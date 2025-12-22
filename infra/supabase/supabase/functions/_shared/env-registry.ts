/**
 * Edge Functions 전용 환경변수 레지스트리
 *
 * [불변 규칙] Edge Functions는 Deno 환경이므로 env-registry 패키지를 직접 import할 수 없습니다.
 * 따라서 Edge Functions 전용 래퍼를 제공합니다.
 *
 * 이 래퍼는 packages/env-registry/src/resolve.ts와 동일한 로직을 사용하지만,
 * Deno 환경에서만 작동하도록 최적화되었습니다.
 */

// Deno 환경에서만 사용 가능
// @ts-ignore - Deno는 Edge Function 환경에서만 존재
const getDenoEnv = (): Record<string, string | undefined> => {
  // @ts-ignore
  if (typeof Deno === 'undefined' || !Deno.env) {
    throw new Error('Deno 환경이 아닙니다. 이 모듈은 Edge Functions에서만 사용할 수 있습니다.');
  }

  // @ts-ignore
  const env: Record<string, string | undefined> = {};
  // @ts-ignore
  const denoEnv = Deno.env.toObject();
  for (const [key, value] of Object.entries(denoEnv)) {
    env[key] = typeof value === 'string' ? value : undefined;
  }
  return env;
};

/**
 * Edge Functions 환경변수 서버 객체
 *
 * [불변 규칙] Edge Functions에서도 env-registry 규칙을 준수합니다.
 * Deno.env.get() 직접 사용 대신 이 객체를 사용해야 합니다.
 */
export const envServer = {
  get SUPABASE_URL(): string {
    const value = getDenoEnv()['SUPABASE_URL'];
    if (!value) {
      throw new Error('SUPABASE_URL 환경변수가 설정되지 않았습니다.');
    }
    return value;
  },

  get SUPABASE_ANON_KEY(): string {
    const value = getDenoEnv()['SUPABASE_ANON_KEY'];
    if (!value) {
      throw new Error('SUPABASE_ANON_KEY 환경변수가 설정되지 않았습니다.');
    }
    return value;
  },

  get SERVICE_ROLE_KEY(): string {
    const value = getDenoEnv()['SUPABASE_SERVICE_ROLE_KEY'];
    if (!value) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY 환경변수가 설정되지 않았습니다.');
    }
    return value;
  },

  get PLATFORM_AI_ENABLED(): string | undefined {
    return getDenoEnv()['PLATFORM_AI_ENABLED'];
  },

  get OPENAI_API_KEY(): string | undefined {
    return getDenoEnv()['OPENAI_API_KEY'];
  },

  get NODE_ENV(): string | undefined {
    return getDenoEnv()['NODE_ENV'];
  },
};

/**
 * 플랫폼 AI 기능 온오프 확인
 * SSOT: 프론트 자동화 문서 "글로벌 헤더 AI 토글 — UX/정책 SSOT" 섹션 참조
 *
 * @returns 플랫폼 AI 기능이 활성화되어 있으면 true, 아니면 false
 */
export function getPlatformAIEnabled(): boolean {
  return envServer.PLATFORM_AI_ENABLED === 'true';
}

