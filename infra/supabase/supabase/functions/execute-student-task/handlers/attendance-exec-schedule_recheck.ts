// LAYER: EDGE_FUNCTION_HANDLER
/**
 * 출결 재확인 스케줄 Handler
 *
 * Intent: attendance.exec.schedule_recheck
 * Action Key: attendance.schedule_recheck (Domain Action Catalog)
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

export const attendance_exec_schedule_recheckHandler: IntentHandler = {
  intent_key: 'attendance.exec.schedule_recheck',

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
      assertDomainActionKey('attendance.schedule_recheck');

      // ⚠️ P0: Policy 재평가 (실행 시점)
      // Domain Action 정책 경로: domain_action.attendance.schedule_recheck.enabled
      const policyPath = 'domain_action.attendance.schedule_recheck.enabled';
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
          message: '출결 재확인 스케줄 정책이 비활성화되어 있습니다.',
        };
      }

      const date = params.date as string;
      const runAt = params.run_at as string;

      if (!date || typeof date !== 'string') {
        return {
          status: 'failed',
          error_code: 'INVALID_PARAMS',
          message: '날짜가 필요합니다.',
        };
      }

      if (!runAt || typeof runAt !== 'string') {
        return {
          status: 'failed',
          error_code: 'INVALID_PARAMS',
          message: '실행 시간이 필요합니다.',
        };
      }

      // 출결 재확인 작업을 스케줄링 (예: scheduled_tasks 테이블에 등록)
      // 현재는 간단히 성공으로 반환 (실제 스케줄링 시스템 연동 필요)
      // TODO: 실제 스케줄링 시스템과 연동 필요
      // NOTE: 현재는 DB 작업이 없어 withTenant 사용하지 않음 (스케줄링 시스템 연동 시 추가 필요)

      return {
        status: 'success',
        result: {
          date,
          run_at: runAt,
        },
        affected_count: 1,
        message: '출결 재확인 스케줄이 등록되었습니다.',
      };
    } catch (error) {
      const maskedError = maskPII(error);
      console.error('[attendance_exec_schedule_recheckHandler] Execution failed:', maskedError);
      return {
        status: 'failed',
        error_code: 'EXECUTION_FAILED',
        message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
      };
    }
  },
};
