// LAYER: EDGE_FUNCTION_HANDLER
/**
 * 수업 세션 이동 Handler
 *
 * Intent: schedule.exec.move_session
 * Action Key: schedule.move_session (Domain Action Catalog)
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

export const schedule_exec_move_sessionHandler: IntentHandler = {
  intent_key: 'schedule.exec.move_session',

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
      assertDomainActionKey('schedule.move_session');

      // ⚠️ P0: Policy 재평가 (실행 시점)
      // Domain Action 정책 경로: domain_action.schedule.move_session.enabled
      const policyPath = 'domain_action.schedule.move_session.enabled';
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
          message: '수업 세션 이동 정책이 비활성화되어 있습니다.',
        };
      }

      const sessionId = params.session_id as string;
      const newStartsAt = params.new_starts_at as string;
      const newEndsAt = params.new_ends_at as string;

      if (!sessionId || typeof sessionId !== 'string') {
        return {
          status: 'failed',
          error_code: 'INVALID_PARAMS',
          message: '세션 ID가 필요합니다.',
        };
      }

      if (!newStartsAt || typeof newStartsAt !== 'string') {
        return {
          status: 'failed',
          error_code: 'INVALID_PARAMS',
          message: '새 시작 시간이 필요합니다.',
        };
      }

      if (!newEndsAt || typeof newEndsAt !== 'string') {
        return {
          status: 'failed',
          error_code: 'INVALID_PARAMS',
          message: '새 종료 시간이 필요합니다.',
        };
      }

      // 수업 세션 시간 업데이트
      const { error: updateError } = await withTenant(
        context.supabase
          .from('class_sessions')
          .update({
            starts_at: newStartsAt,
            ends_at: newEndsAt,
          })
          .eq('id', sessionId),
        context.tenant_id
      );

      if (updateError) {
        const maskedError = maskPII(updateError);
        console.error('[schedule_exec_move_sessionHandler] Failed to move session:', maskedError);
        return {
          status: 'failed',
          error_code: 'EXECUTION_FAILED',
          message: '수업 세션 이동에 실패했습니다.',
        };
      }

      return {
        status: 'success',
        result: {
          session_id: sessionId,
          new_starts_at: newStartsAt,
          new_ends_at: newEndsAt,
        },
        affected_count: 1,
        message: '수업 세션 이동이 완료되었습니다.',
      };
    } catch (error) {
      const maskedError = maskPII(error);
      console.error('[schedule_exec_move_sessionHandler] Execution failed:', maskedError);
      return {
        status: 'failed',
        error_code: 'EXECUTION_FAILED',
        message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
      };
    }
  },
};
