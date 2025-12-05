import { z } from 'zod';

// 서버/Edge 전용 스키마 (모든 환경변수 포함)
export const envServerSchema = z.object({
  // Supabase
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SERVICE_ROLE_KEY: z.string().min(1),  // Edge Function / 서버 전용
  SUPABASE_READ_REPLICA_URL: z.string().url().optional(),  // Phase 2+ Read Replica (읽기 전용)
  
  // 환경 구분
  NODE_ENV: z.enum(['development', 'staging', 'production']),
  
  // 결제/알림뱅킹 (Phase 1 필수, 실제 사용 시점에 requireEnv()로 체크)
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
  
  // Kakao Maps API (Phase 2+ 지도 기능용, 서버/Edge Function 전용)
  KAKAO_REST_API_KEY: z.string().min(1).optional(),
});

// 클라이언트 전용 스키마 (NEXT_PUBLIC_* 등 빌드타임 노출 값만)
export const envClientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),  // 필수
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),  // 필수
  NEXT_PUBLIC_KAKAO_JS_KEY: z.string().min(1).optional(),  // Phase 2+ 지도 기능용 (JavaScript SDK)
  // 클라이언트에 노출 가능한 공개 값만 포함
  // 절대 Service Role Key나 비밀 값 포함 금지
});

// 서버/Edge 전용 공통 스키마 (앱명, 버전정보 등)
// 클라이언트에서 필요한 값은 NEXT_PUBLIC_*로 envClient에 포함
export const envCommonSchema = z.object({
  APP_NAME: z.string().min(1).optional(),
  APP_VERSION: z.string().min(1).optional(),
  INDUSTRY_MODE: z.enum(['academy', 'salon', 'realestate', 'gym', 'ngo']).optional(),
  // 서버/Edge에서만 사용하는 공개 값
});

export type EnvServer = z.infer<typeof envServerSchema>;
export type EnvClient = z.infer<typeof envClientSchema>;
export type EnvCommon = z.infer<typeof envCommonSchema>;

