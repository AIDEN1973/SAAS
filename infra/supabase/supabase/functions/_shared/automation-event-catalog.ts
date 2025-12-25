/**
 * Automation Event Catalog (SSOT) - Edge Function용 (Re-export)
 *
 * ⚠️ 중요: 이 파일은 infra/supabase/functions/_shared/automation-event-catalog.ts의 re-export입니다.
 * 실제 구현은 infra/supabase/functions/_shared/automation-event-catalog.ts에 있으며,
 * 이 파일은 하위 호환성을 위해 유지됩니다.
 *
 * 자동화 event_type 카탈로그 정본(SSOT)
 * [불변 규칙] 이 카탈로그에 없는 event_type은 실행/추가할 수 없습니다.
 * [불변 규칙] 카탈로그 수정 시 문서(AI_자동화_기능_정리.md)와 동기화 필수
 *
 * 참고: docu/AI_자동화_기능_정리.md Section 11
 *
 * ⚠️ 동기화 필수: 정본은 다음 파일입니다:
 * - packages/core/core-automation/src/automation-event-catalog.ts (최상위 정본)
 * - infra/supabase/functions/_shared/automation-event-catalog.ts (Edge Function 구현)
 *
 * 이 파일은 infra/supabase/functions/_shared/automation-event-catalog.ts를 re-export합니다.
 */

// 정본 파일에서 re-export (상대 경로: ../../functions/_shared/automation-event-catalog.ts)
export {
  AUTOMATION_EVENT_CATALOG,
  type AutomationEventType,
  isAutomationEventType,
  assertAutomationEventType,
} from '../../functions/_shared/automation-event-catalog.ts';

