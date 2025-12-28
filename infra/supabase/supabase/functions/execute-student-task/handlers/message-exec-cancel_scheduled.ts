// LAYER: EDGE_FUNCTION_HANDLER
/**
 * 예약 메시지 취소 Handler
 *
 * Intent: message.exec.cancel_scheduled
 * Action Key: message.cancel_scheduled (Domain Action Catalog)
 *
 * 챗봇.md 12.1.3 참조
 *
 */

import type {
  IntentHandler,
  SuggestedActionChatOpsPlanV1,
  HandlerContext,
  HandlerResult,
} from './types.ts';
import { maskPII } from '../../_shared/pii-utils.ts';
import { getTenantSettingByPath } from '../../_shared/policy-utils.ts';
import { withTenant } from '../../_shared/withTenant.ts';
import { assertDomainActionKey } from '../../_shared/domain-action-catalog.ts';

export const message_exec_cancel_scheduledHandler: IntentHandler = {
  intent_key: 'message.exec.cancel_scheduled',

  async execute(
    plan: SuggestedActionChatOpsPlanV1,
    context: HandlerContext
  ): Promise<HandlerResult> {
    try {
      // ⚠️ P0: Plan 스냅샷에서만 실행 대상 로드 (클라이언트 입력 무시)
      const params = plan.params as Record<string, unknown>;

      if (!params || typeof params !== 'object') {
        return {
          status: 'failed',
          error_code: 'INVALID_PARAMS',
          message: '파라미터가 필요합니다.',
        };
      }

      // ⚠️ P0: Domain Action Catalog 검증 (Fail-Closed)
      assertDomainActionKey('message.cancel_scheduled');

      // ⚠️ P0: Policy 재평가 (실행 시점)
      // Domain Action 정책 경로: domain_action.message.cancel_scheduled.enabled
      const policyPath = 'domain_action.message.cancel_scheduled.enabled';
      const policyEnabled = await getTenantSettingByPath(
        context.supabase,
        context.tenant_id,
        policyPath
      );

      if (!policyEnabled || policyEnabled !== true) {
        return {
          status: 'failed',
          error_code: 'POLICY_DISABLED',
          message: '예약 메시지 취소 정책이 비활성화되어 있습니다.',
        };
      }

      const scheduleId = params.schedule_id as string;

      if (!scheduleId || typeof scheduleId !== 'string') {
        return {
          status: 'failed',
          error_code: 'INVALID_PARAMS',
          message: '예약 ID가 필요합니다.',
        };
      }

      // 예약 메시지 취소 (scheduled_messages 또는 notifications 테이블에서 상태 변경)
      // TODO: 실제 scheduled_messages 테이블 구조 확인 필요
      const { error: cancelError } = await withTenant(
        context.supabase
          .from('notifications')
          .update({ status: 'cancelled' })
          .eq('id', scheduleId)
          .in('status', ['pending', 'scheduled']),
        context.tenant_id
      );

      if (cancelError) {
        const maskedError = maskPII(cancelError);
        console.error('[message_exec_cancel_scheduledHandler] Failed to cancel scheduled message:', maskedError);
        return {
          status: 'failed',
          error_code: 'EXECUTION_FAILED',
          message: '예약 메시지 취소에 실패했습니다.',
        };
      }

      return {
        status: 'success',
        result: {
          schedule_id: scheduleId,
        },
        affected_count: 1,
        message: '예약 메시지 취소가 완료되었습니다.',
      };
    } catch (error) {
      const maskedError = maskPII(error);
      console.error('[message_exec_cancel_scheduledHandler] Execution failed:', maskedError);
      return {
        status: 'failed',
        error_code: 'EXECUTION_FAILED',
        message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
      };
    }
  },
};
