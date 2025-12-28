// LAYER: EDGE_FUNCTION_HANDLER
/**
 * 수업 세션 취소 Handler
 *
 * Intent: schedule.exec.cancel_session
 * Action Key: schedule.cancel_session (Domain Action Catalog)
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

export const schedule_exec_cancel_sessionHandler: IntentHandler = {
  intent_key: 'schedule.exec.cancel_session',

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
      assertDomainActionKey('schedule.cancel_session');

      // ⚠️ P0: Policy 재평가 (실행 시점)
      // Domain Action 정책 경로: domain_action.schedule.cancel_session.enabled
      const policyPath = 'domain_action.schedule.cancel_session.enabled';
      const policyEnabled = await getTenantSettingByPath(
        context.supabase,
        context.tenant_id,
        policyPath
      );

      // 정책이 없으면 기본값으로 true 사용 (마이그레이션 미실행 시 호환성)
      // 정책이 명시적으로 false로 설정된 경우에만 비활성화
      if (policyEnabled === false) {
        return {
          status: 'failed',
          error_code: 'POLICY_DISABLED',
          message: '수업 세션 취소 정책이 비활성화되어 있습니다.',
        };
      }

      const sessionId = params.session_id as string;
      const reason = params.reason as string | undefined;

      if (!sessionId || typeof sessionId !== 'string') {
        return {
          status: 'failed',
          error_code: 'INVALID_PARAMS',
          message: '세션 ID가 필요합니다.',
        };
      }

      // 수업 세션 삭제 (또는 cancelled 상태로 변경)
      // TODO: 실제 테이블 구조에 따라 삭제 또는 상태 변경
      const { error: deleteError } = await withTenant(
        context.supabase
          .from('class_sessions')
          .delete()
          .eq('id', sessionId),
        context.tenant_id
      );

      if (deleteError) {
        const maskedError = maskPII(deleteError);
        console.error('[schedule_exec_cancel_sessionHandler] Failed to cancel session:', maskedError);
        return {
          status: 'failed',
          error_code: 'EXECUTION_FAILED',
          message: '수업 세션 취소에 실패했습니다.',
        };
      }

      return {
        status: 'success',
        result: {
          session_id: sessionId,
        },
        affected_count: 1,
        message: '수업 세션 취소가 완료되었습니다.',
      };
    } catch (error) {
      const maskedError = maskPII(error);
      console.error('[schedule_exec_cancel_sessionHandler] Execution failed:', maskedError);
      return {
        status: 'failed',
        error_code: 'EXECUTION_FAILED',
        message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
      };
    }
  },
};
