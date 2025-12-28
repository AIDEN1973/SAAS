// LAYER: EDGE_FUNCTION_HANDLER
/**
 * 퇴원 학생 재활성화 Handler
 *
 * Intent: student.exec.reactivate_from_discharged
 * Action Key: student.reactivate_from_discharged (Domain Action Catalog)
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

export const student_exec_reactivate_from_dischargedHandler: IntentHandler = {
  intent_key: 'student.exec.reactivate_from_discharged',

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
      assertDomainActionKey('student.reactivate_from_discharged');

      // ⚠️ P0: Policy 재평가 (실행 시점)
      // Domain Action 정책 경로: domain_action.student.reactivate_from_discharged.enabled
      const policyPath = 'domain_action.student.reactivate_from_discharged.enabled';
      const policyEnabled = await getTenantSettingByPath(
        context.supabase,
        context.tenant_id,
        policyPath
      );

      if (!policyEnabled || policyEnabled !== true) {
        return {
          status: 'failed',
          error_code: 'POLICY_DISABLED',
          message: '퇴원 학생 재활성화 정책이 비활성화되어 있습니다.',
        };
      }

      const studentId = params.student_id as string;
      const date = params.date as string;

      if (!studentId || typeof studentId !== 'string') {
        return {
          status: 'failed',
          error_code: 'INVALID_PARAMS',
          message: '학생 ID가 필요합니다.',
        };
      }

      if (!date || typeof date !== 'string') {
        return {
          status: 'failed',
          error_code: 'INVALID_PARAMS',
          message: '재활성화일이 필요합니다.',
        };
      }

      // Industry Adapter: 업종별 학생 테이블명 동적 조회
      const studentTableName = await getTenantTableName(context.supabase, context.tenant_id, 'student');

      // academy_students 테이블에서 status를 'active'로 변경
      const { error: updateError } = await withTenant(
        context.supabase
          .from(studentTableName || 'academy_students') // Fallback
          .update({
            status: 'active',
            updated_by: context.user_id,
          })
          .eq('person_id', studentId),
        context.tenant_id
      );

      if (updateError) {
        const maskedError = maskPII(updateError);
        console.error('[student_exec_reactivate_from_dischargedHandler] Failed to update student status:', maskedError);
        return {
          status: 'failed',
          error_code: 'EXECUTION_FAILED',
          message: '퇴원 학생 재활성화에 실패했습니다.',
        };
      }

      return {
        status: 'success',
        result: {
          student_id: studentId,
          status: 'active',
          reactivated_date: date,
        },
        affected_count: 1,
        message: '퇴원 학생 재활성화가 완료되었습니다.',
      };
    } catch (error) {
      const maskedError = maskPII(error);
      console.error('[student_exec_reactivate_from_dischargedHandler] Execution failed:', maskedError);
      return {
        status: 'failed',
        error_code: 'EXECUTION_FAILED',
        message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
      };
    }
  },
};
