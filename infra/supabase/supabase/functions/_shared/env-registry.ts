/**
 * Edge Functions 전용 환경변수 레지스트리 (Re-export)
 *
 * ⚠️ 중요: 이 파일은 infra/supabase/functions/_shared/env-registry.ts의 re-export입니다.
 * 실제 구현은 infra/supabase/functions/_shared/env-registry.ts에 있으며,
 * 이 파일은 하위 호환성을 위해 유지됩니다.
 *
 * [불변 규칙] Edge Functions는 Deno 환경이므로 env-registry 패키지를 직접 import할 수 없습니다.
 * 따라서 Edge Functions 전용 래퍼를 제공합니다.
 *
 * ⚠️ 동기화 필수: 정본은 다음 파일입니다:
 * - packages/env-registry/src/schema.ts (스키마 정본)
 * - infra/supabase/functions/_shared/env-registry.ts (Edge Function 구현)
 *
 * 이 파일은 infra/supabase/functions/_shared/env-registry.ts를 re-export합니다.
 */

// 정본 파일에서 re-export (상대 경로: ../../functions/_shared/env-registry.ts)
export {
  envServer,
  getPlatformAIEnabled,
} from '../../functions/_shared/env-registry.ts';

