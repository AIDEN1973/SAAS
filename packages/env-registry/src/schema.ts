import { z } from 'zod';

// 서버/Edge 사용 스키마(모든 환경변수 포함)
export const envServerSchema = z.object({
  // Supabase
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SERVICE_ROLE_KEY: z.string().min(1),  // Edge Function / 서버 사용
  SUPABASE_READ_REPLICA_URL: z.string().url().optional(),  // Phase 2+ Read Replica (읽기 전용)

  // 환경 구분
  NODE_ENV: z.enum(['development', 'staging', 'production']),

  // 결제/알림뱅킹 (Phase 1 선택, 실제 사용 시점에 requireEnv()로 체크)
  PAYMENT_ALIMBANK_API_URL: z.string().url().optional(),
  PAYMENT_ALIMBANK_API_KEY: z.string().min(1).optional(),
  PAYMENT_WEBHOOK_SECRET: z.string().min(1).optional(),

  // Phase 2+ (Role 분리)
  PAYMENT_WEBHOOK_ROLE_KEY: z.string().min(1).optional(),
  BILLING_BATCH_ROLE_KEY: z.string().min(1).optional(),
  ANALYTICS_ROLE_KEY: z.string().min(1).optional(),

  // Custom Domain (Phase 2+)
  CUSTOM_DOMAIN_VERIFY_SECRET: z.string().min(1).optional(),

  // 외부 워커 (Phase 2+)
  AWS_LAMBDA_ANALYTICS_FUNCTION_NAME: z.string().optional(),
  CLOUDFLARE_WORKER_ANALYTICS_URL: z.string().url().optional(),

  // Kakao Maps API (Phase 2+ 지도기능용 서버/Edge Function 사용)
  KAKAO_REST_API_KEY: z.string().min(1).optional(),

  // OpenAI API (AI 분석 기능용)
  OPENAI_API_KEY: z.string().min(1).optional(),

  // AI 기능 플랫폼 전체 온오프 (env-registry/server에서만 읽음, 기본값: true)
  // SSOT: 프론트 자동화 문서 "글로벌 헤더 AI 토글 — UX/정책 SSOT" 섹션 참조
  PLATFORM_AI_ENABLED: z.string().optional().default('true').transform((val) => val === 'true' || val === '1'),
});

// 클라이언트 사용 스키마(NEXT_PUBLIC_*는 빌드 타임에 추출 값만)
export const envClientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),  // 필수
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),  // 필수
  NEXT_PUBLIC_KAKAO_JS_KEY: z.string().min(1).optional(),  // Phase 2+ 지도기능용(JavaScript SDK)
  // 클라이언트에 노출 가능한 공개 값만 포함
  // 절대 Service Role Key는 비밀 값이므로 포함 금지
});

// 서버/Edge 사용 공통 스키마(앱명, 버전정보 등)
// 클라이언트에서도 필요한 값은 NEXT_PUBLIC_*로 envClient에 포함
export const envCommonSchema = z.object({
  APP_NAME: z.string().min(1).optional(),
  APP_VERSION: z.string().min(1).optional(),
  INDUSTRY_MODE: z.enum(['academy', 'salon', 'real_estate', 'gym', 'ngo']).optional(),  // 정본: real_estate (언더스코어 필수)
  // 서버/Edge에서 사용하는 공개 값
});

export type EnvServer = z.infer<typeof envServerSchema>;
export type EnvClient = z.infer<typeof envClientSchema>;
export type EnvCommon = z.infer<typeof envCommonSchema>;
