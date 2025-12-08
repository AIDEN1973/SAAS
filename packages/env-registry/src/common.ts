import { envCommonSchema, type EnvCommon } from './schema';
import { resolveEnv } from './resolve';

let cachedEnv: EnvCommon | null = null;

/**
 * 서버/Edge 용 공개 설정
 * APP_NAME, APP_VERSION, INDUSTRY_MODE 등
 */
export function getEnvCommon(): EnvCommon {
  if (cachedEnv) {
    return cachedEnv;
  }

  const raw = resolveEnv();
  const result = envCommonSchema.safeParse(raw);

  if (!result.success) {
    // 공통 환경변수는 선택적이므로 기본값 사용
    cachedEnv = envCommonSchema.parse({});
    return cachedEnv;
  }

  cachedEnv = result.data;
  return cachedEnv;
}

// 기본 export
export const envCommon = getEnvCommon();
