import { envServerSchema, type EnvServer } from './schema';
import { resolveEnv } from './resolve';

// 로컬 개발 환경에서 dotenv로 .env.local 파일 로드 (중앙 관리)
// 루트 디렉토리의 .env.local 파일을 자동으로 로드
if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV !== 'production') {
  try {
    const dotenv = require('dotenv');
    const path = require('path');
    const fs = require('fs');

    // 루트 디렉토리의 .env.local 파일 찾기
    // process.cwd()는 보통 프로젝트 루트를 가리킴
    const rootEnvPath = path.resolve(process.cwd(), '.env.local');

    if (fs.existsSync(rootEnvPath)) {
      const result = dotenv.config({ path: rootEnvPath });
      if (result.error) {
        console.warn(`[env-registry] 환경변수 파일 로드 실패: ${result.error.message}`);
      } else {
        console.log(`[env-registry] 환경변수 파일 로드 완료: ${rootEnvPath}`);
      }
    } else {
      console.warn(`[env-registry] .env.local 파일을 찾을 수 없습니다: ${rootEnvPath}`);
      console.warn(`[env-registry] 루트 디렉토리에 .env.local 파일을 생성하세요.`);
    }
  } catch (error) {
    // dotenv가 없거나 로드 실패 시 무시 (이미 process.env에 설정되어 있을 수 있음)
    console.warn(`[env-registry] dotenv 로드 실패:`, error);
  }
}

function validateEnvServer(): EnvServer {
  const rawEnv = resolveEnv();
  const parsed = envServerSchema.safeParse(rawEnv);

  if (!parsed.success) {
    const errors = parsed.error.errors.map(e =>
      `${e.path.join('.')}: ${e.message}`
    ).join('\n');

    const missingVars = parsed.error.errors
      .filter(e => e.code === 'invalid_type' && e.received === 'undefined')
      .map(e => e.path.join('.'))
      .join(', ');

    throw new Error(
      `환경변수 검증 실패:\n${errors}\n\n` +
      (missingVars ? `필수 환경변수: ${missingVars}\n\n` : '') +
      `필수 환경변수가 누락되었거나 형식이 잘못되었습니다.\n` +
      `프로젝트 루트 디렉토리에 .env.local 파일을 생성하거나 packages/env-registry/.env.example 파일을 참고하세요.`
    );
  }

  return parsed.data;
}

// 애플리케이션 시작 시 한 번만 검증
export const envServer = validateEnvServer();

// 안전한 타입으로 접근
// 사용 예: envServer.SUPABASE_URL, envServer.SERVICE_ROLE_KEY

/**
 * 플랫폼 AI 기능 온오프 확인
 * SSOT: 프론트 자동화 문서 "글로벌 헤더 AI 토글 — UX/정책 SSOT" 섹션 참조
 *
 * @returns 플랫폼 AI 기능이 활성화되어 있으면 true, 아니면 false
 */
export function getPlatformAIEnabled(): boolean {
  return envServer.PLATFORM_AI_ENABLED ?? true; // 기본값: true (활성화)
}
