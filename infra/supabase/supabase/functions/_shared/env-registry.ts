/**
 * Edge Functions 전용 환경변수 레지스트리
 *
 * [불변 규칙] Edge Functions는 Deno 환경이므로 env-registry 패키지를 직접 import할 수 없습니다.
 * 따라서 Edge Functions 전용 래퍼를 제공합니다.
 *
 * [중앙 관리] 로컬 개발 시 프로젝트 루트의 .env.local 파일을 자동으로 로드합니다.
 * 이 래퍼는 packages/env-registry/src/resolve.ts와 동일한 로직을 사용하지만,
 * Deno 환경에서만 작동하도록 최적화되었습니다.
 */

// Deno 환경에서만 사용 가능
// @ts-ignore - Deno는 Edge Function 환경에서만 존재
// ⚠️ 성능 최적화: 환경변수를 한 번만 읽어서 캐싱 (getter에서 반복 호출 방지)
let cachedDenoEnv: Record<string, string | undefined> | null = null;

/**
 * 로컬 개발 환경에서 .env.local 파일 로드 (중앙 관리)
 * 프로젝트 루트 디렉토리의 .env.local 파일을 읽어서 환경변수에 병합
 *
 * [중앙 관리] 프로젝트 루트의 .env.local 파일을 자동으로 찾아서 로드합니다.
 * 현재 디렉토리에서 상위로 올라가면서 .env.local 파일을 찾습니다.
 */
function loadLocalEnvFile(): Record<string, string | undefined> {
  try {
    // @ts-ignore
    const cwd = Deno.cwd();

    // 현재 디렉토리에서 상위로 올라가면서 .env.local 파일 찾기
    const pathParts = cwd.split(/[/\\]/);
    const possiblePaths: string[] = [];

    // 각 상위 디렉토리에서 .env.local 파일 경로 생성
    for (let i = pathParts.length; i > 0; i--) {
      const path = pathParts.slice(0, i).join('/');
      possiblePaths.push(`${path}/.env.local`);
    }

    // 현재 디렉토리도 포함
    possiblePaths.push(`${cwd}/.env.local`);

    for (const envLocalPath of possiblePaths) {
      try {
        // @ts-ignore
        const envFileContent = Deno.readTextFileSync(envLocalPath);
        const env: Record<string, string | undefined> = {};

        // 간단한 .env 파일 파싱 (주석, 빈 줄 제외)
        for (const line of envFileContent.split('\n')) {
          const trimmed = line.trim();
          // 주석이나 빈 줄 건너뛰기
          if (!trimmed || trimmed.startsWith('#')) continue;

          const equalIndex = trimmed.indexOf('=');
          if (equalIndex === -1) continue;

          const key = trimmed.substring(0, equalIndex).trim();
          let value = trimmed.substring(equalIndex + 1).trim();

          // 따옴표 제거 (있는 경우)
          value = value.replace(/^["']|["']$/g, '');

          if (key) {
            env[key] = value || undefined;
          }
        }

        return env;
      } catch (fileError) {
        // 파일이 없으면 다음 경로 시도
        continue;
      }
    }

    // 모든 경로에서 파일을 찾지 못함
    return {};
  } catch (error) {
    // 파일 읽기 실패 시 무시
    return {};
  }
}

const getDenoEnv = (): Record<string, string | undefined> => {
  if (cachedDenoEnv !== null) {
    return cachedDenoEnv;
  }

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

  // 로컬 개발 환경에서 .env.local 파일 로드 (중앙 관리)
  // 환경변수가 없을 때만 .env.local에서 로드
  const hasRequiredEnv = env['SUPABASE_URL'] && (env['SERVICE_ROLE_KEY'] || env['SUPABASE_SERVICE_ROLE_KEY']);
  if (!hasRequiredEnv) {
    const localEnv = loadLocalEnvFile();
    // .env.local의 값으로 덮어쓰기 (환경변수가 우선)
    for (const [key, value] of Object.entries(localEnv)) {
      if (!env[key] && value) {
        env[key] = value;
      }
    }
  }

  cachedDenoEnv = env;
  return env;
};

/**
 * Edge Functions 환경변수 서버 객체
 *
 * [불변 규칙] Edge Functions에서도 env-registry 규칙을 준수합니다.
 * Deno.env.get() 직접 사용 대신 이 객체를 사용해야 합니다.
 *
 * [중앙 관리] 로컬 개발 시 프로젝트 루트의 .env.local 파일을 자동으로 로드합니다.
 */
export const envServer = {
  get SUPABASE_URL(): string {
    const value = getDenoEnv()['SUPABASE_URL'];
    if (!value) {
      throw new Error('SUPABASE_URL 환경변수가 설정되지 않았습니다. 프로젝트 루트의 .env.local 파일을 확인하세요.');
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
    // ⚠️ 환경변수명 통일: Supabase는 SUPABASE_SERVICE_ROLE_KEY를 사용하지만,
    // packages/env-registry/src/schema.ts는 SERVICE_ROLE_KEY를 기대합니다.
    // Supabase 환경에서는 SUPABASE_SERVICE_ROLE_KEY를 우선 조회하고, 없으면 SERVICE_ROLE_KEY를 조회합니다.
    const env = getDenoEnv();
    const value = env['SUPABASE_SERVICE_ROLE_KEY'] || env['SERVICE_ROLE_KEY'];
    if (!value) {
      throw new Error('SERVICE_ROLE_KEY 또는 SUPABASE_SERVICE_ROLE_KEY 환경변수가 설정되지 않았습니다. 프로젝트 루트의 .env.local 파일을 확인하세요.');
    }
    return value;
  },

  get SUPABASE_READ_REPLICA_URL(): string | undefined {
    return getDenoEnv()['SUPABASE_READ_REPLICA_URL'];
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

  // 결제/알림뱅킹 (Phase 1 선택, 실제 사용 시점에 requireEnv()로 체크)
  get PAYMENT_ALIMBANK_API_URL(): string | undefined {
    return getDenoEnv()['PAYMENT_ALIMBANK_API_URL'];
  },

  get PAYMENT_ALIMBANK_API_KEY(): string | undefined {
    return getDenoEnv()['PAYMENT_ALIMBANK_API_KEY'];
  },

  get PAYMENT_WEBHOOK_SECRET(): string | undefined {
    return getDenoEnv()['PAYMENT_WEBHOOK_SECRET'];
  },

  // [불변 규칙] Role 분리: 상용화 단계에서 Role 분리 구현
  get PAYMENT_WEBHOOK_ROLE_KEY(): string | undefined {
    return getDenoEnv()['PAYMENT_WEBHOOK_ROLE_KEY'];
  },

  get BILLING_BATCH_ROLE_KEY(): string | undefined {
    return getDenoEnv()['BILLING_BATCH_ROLE_KEY'];
  },

  get ANALYTICS_ROLE_KEY(): string | undefined {
    return getDenoEnv()['ANALYTICS_ROLE_KEY'];
  },

  // Custom Domain (Phase 2+)
  get CUSTOM_DOMAIN_VERIFY_SECRET(): string | undefined {
    return getDenoEnv()['CUSTOM_DOMAIN_VERIFY_SECRET'];
  },

  // 외부 워커 (Phase 2+)
  get AWS_LAMBDA_ANALYTICS_FUNCTION_NAME(): string | undefined {
    return getDenoEnv()['AWS_LAMBDA_ANALYTICS_FUNCTION_NAME'];
  },

  get CLOUDFLARE_WORKER_ANALYTICS_URL(): string | undefined {
    return getDenoEnv()['CLOUDFLARE_WORKER_ANALYTICS_URL'];
  },

  // Kakao Maps API (Phase 2+ 지도기능용 서버/Edge Function 사용)
  get KAKAO_REST_API_KEY(): string | undefined {
    return getDenoEnv()['KAKAO_REST_API_KEY'];
  },
};

/**
 * 플랫폼 AI 기능 온오프 확인
 * SSOT: 프론트 자동화 문서 "글로벌 헤더 AI 토글 — UX/정책 SSOT" 섹션 참조
 *
 * ⚠️ 일관성: packages/env-registry/src/server.ts의 getPlatformAIEnabled()와 동일한 로직 사용
 * 기본값: true (활성화)
 *
 * @returns 플랫폼 AI 기능이 활성화되어 있으면 true, 아니면 false
 */
export function getPlatformAIEnabled(): boolean {
  const value = envServer.PLATFORM_AI_ENABLED;
  // packages/env-registry/src/server.ts와 동일한 로직: 기본값 true
  return value === 'true' || value === '1' || value === undefined;
}

/**
 * Edge Function env-registry와 packages/env-registry 스키마 동기화 검증 함수
 *
 * ⚠️ 빌드 타임 검증: 이 함수는 빌드 시 또는 CI에서 호출하여
 * Edge Function envServer의 필드가 packages/env-registry/src/schema.ts의
 * envServerSchema와 일치하는지 검증합니다.
 *
 * ⚠️ 중요: 이 함수는 Edge Function 런타임에서는 사용되지 않으며,
 * 빌드 타임 또는 CI/CD 파이프라인에서만 호출됩니다.
 * 실제 검증은 scripts/verify-ssot-sync.ts에서 파일을 읽어서 수행합니다.
 * 이 함수는 Edge Function 환경에서 직접 검증이 필요한 경우를 위한 보조 함수입니다.
 *
 * @returns 검증 오류 배열 (오류가 없으면 빈 배열)
 */
export function validateEnvRegistrySync(): string[] {
  const errors: string[] = [];

  // packages/env-registry/src/schema.ts의 envServerSchema 필드 목록 (수동 동기화 필요)
  // ⚠️ 중요: 스키마 변경 시 이 목록도 함께 업데이트해야 합니다.
  const schemaFields = [
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'SERVICE_ROLE_KEY',
    'SUPABASE_READ_REPLICA_URL',
    'NODE_ENV',
    'PAYMENT_ALIMBANK_API_URL',
    'PAYMENT_ALIMBANK_API_KEY',
    'PAYMENT_WEBHOOK_SECRET',
    'PAYMENT_WEBHOOK_ROLE_KEY',
    'BILLING_BATCH_ROLE_KEY',
    'ANALYTICS_ROLE_KEY',
    'CUSTOM_DOMAIN_VERIFY_SECRET',
    'AWS_LAMBDA_ANALYTICS_FUNCTION_NAME',
    'CLOUDFLARE_WORKER_ANALYTICS_URL',
    'KAKAO_REST_API_KEY',
    'OPENAI_API_KEY',
    'PLATFORM_AI_ENABLED',
  ];

  // envServer 객체의 getter 목록 추출
  // ⚠️ 중요: envServer는 객체 리터럴이므로 Object.getOwnPropertyDescriptors를 사용하여 getter를 추출합니다.
  const envServerGetters: string[] = [];
  const descriptors = Object.getOwnPropertyDescriptors(envServer);
  for (const [key, descriptor] of Object.entries(descriptors)) {
    // getter가 있는 속성만 추출
    if (descriptor.get) {
      envServerGetters.push(key.toUpperCase());
    }
  }

  // 누락된 필드 검증
  for (const field of schemaFields) {
    if (!envServerGetters.includes(field)) {
      errors.push(
        `[Env Registry Sync] Missing field in Edge Function envServer: "${field}"`
      );
    }
  }

  // 추가된 필드 검증 (스키마에 없는 필드)
  for (const getter of envServerGetters) {
    if (!schemaFields.includes(getter)) {
      errors.push(
        `[Env Registry Sync] Extra field in Edge Function envServer (not in schema): "${getter}"`
      );
    }
  }

  return errors;
}

