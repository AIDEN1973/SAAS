/**
 * Policy 조회 유틸리티 함수 (Re-export)
 *
 * ⚠️ 중요: 이 파일은 infra/supabase/functions/_shared/policy-utils.ts의 re-export입니다.
 * 실제 구현은 infra/supabase/functions/_shared/policy-utils.ts에 있으며,
 * 이 파일은 하위 호환성을 위해 유지됩니다.
 *
 * [불변 규칙] Automation Config First: 모든 자동화는 Policy 기반으로만 동작
 * [불변 규칙] Fail Closed: Policy가 없으면 실행하지 않음
 * [문서 준수] docu/프론트 자동화.md, docu/AI_자동화_기능_정리.md 엄격 준수
 *
 * ⚠️ 동기화 필수: 정본은 다음 파일입니다:
 * - infra/supabase/functions/_shared/policy-utils.ts (Edge Function 구현)
 *
 * 이 파일은 infra/supabase/functions/_shared/policy-utils.ts를 re-export합니다.
 */

// 정본 파일에서 re-export (상대 경로: ../../functions/_shared/policy-utils.ts)
export {
  getTenantSetting,
  getTenantSettingByPath,
  shouldUseAI,
} from '../../functions/_shared/policy-utils.ts';
