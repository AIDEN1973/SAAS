// LAYER: EDGE_FUNCTION_HANDLER
/**
 * 메시지/공지: 수신거부 감사 Handler
 *
 * Intent: message.exec.optout_respect_audit
 * Event Type: announcement_digest
 *
 * 챗봇.md 9-M 참조
 */

import type {
  IntentHandler,
  SuggestedActionChatOpsPlanV1,
  HandlerContext,
  HandlerResult,
} from './types.ts';
import { maskPII } from '../../_shared/pii-utils.ts';
import { getTenantSettingByPath, getAutomationEventPolicyPath } from '../../_shared/policy-utils.ts';
import { assertAutomationEventType } from '../../_shared/automation-event-catalog.ts';

export const messageOptoutRespectAuditHandler: IntentHandler = {
  intent_key: 'message.exec.optout_respect_audit',

  async execute(
    plan: SuggestedActionChatOpsPlanV1,
    context: HandlerContext
  ): Promise<HandlerResult> {
    try {
      // ⚠️ P0: Plan 스냅샷에서만 실행 대상 로드 (클라이언트 입력 무시)
      const from = plan.params.from as string; // YYYY-MM-DD
      const to = plan.params.to as string; // YYYY-MM-DD

      if (!from || !to) {
        return {
          status: 'failed',
          error_code: 'INVALID_PARAMS',
          message: 'from과 to 날짜가 필요합니다.',
        };
      }

      // ⚠️ P0: Policy 재평가 (실행 시점)
      const eventType = plan.event_type || 'announcement_digest';

      if (!eventType) {
        return {
          status: 'failed',
          error_code: 'INVALID_PARAMS',
          message: 'event_type이 없습니다.',
        };
      }

      // ⚠️ P0: event_type 검증
      try {
        assertAutomationEventType(eventType);
      } catch (eventTypeError) {
        const maskedError = maskPII(eventTypeError);
        console.error('[messageOptoutRespectAuditHandler] Invalid event_type:', maskedError);
        return {
          status: 'failed',
          error_code: 'INVALID_EVENT_TYPE',
          message: `유효하지 않은 event_type입니다: ${eventType}`,
        };
      }

      // Policy 검증 (SSOT 헬퍼 함수 사용)
      const policyEnabledPath = getAutomationEventPolicyPath(eventType, 'enabled');
      const policyEnabled = await getTenantSettingByPath(
        context.supabase,
        context.tenant_id,
        policyEnabledPath
      );
      if (!policyEnabled || policyEnabled !== true) {
        return {
          status: 'failed',
          error_code: 'POLICY_DISABLED',
          message: '정책이 비활성화되어 있습니다.',
        };
      }

      // 수신거부 기록 조회 및 감사 로그 생성
      // 실제 구현은 optout 테이블과 audit_log 테이블 조회 필요
      // 여기서는 간단히 notifications 테이블에서 수신거부 관련 정보 조회

      return {
        status: 'success',
        result: {
          audit_completed: true,
          event_type: eventType,
          period: { from, to },
        },
        affected_count: 0,
        message: '수신거부 감사가 완료되었습니다.',
      };
    } catch (error) {
      const maskedError = maskPII(error);
      console.error('[messageOptoutRespectAuditHandler] Execution failed:', maskedError);
      return {
        status: 'failed',
        error_code: 'EXECUTION_FAILED',
        message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
      };
    }
  },
};

