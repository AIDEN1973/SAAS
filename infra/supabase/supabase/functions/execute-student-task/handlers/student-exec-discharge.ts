// LAYER: EDGE_FUNCTION_HANDLER
/**
 * 학생 퇴원 처리 Handler
 *
 * Intent: student.exec.discharge
 * Action Key: student.discharge (Domain Action Catalog)
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
import { getTenantTableName } from '../../_shared/industry-adapter.ts';

export const student_exec_dischargeHandler: IntentHandler = {
  intent_key: 'student.exec.discharge',

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
      assertDomainActionKey('student.discharge');

      // ⚠️ P0: Policy 재평가 (실행 시점)
      // Domain Action 정책 경로: domain_action.student.discharge.enabled
      const policyPath = 'domain_action.student.discharge.enabled';
      const policyEnabled = await getTenantSettingByPath(
        context.supabase,
        context.tenant_id,
        policyPath
      );

      if (!policyEnabled || policyEnabled !== true) {
        return {
          status: 'failed',
          error_code: 'POLICY_DISABLED',
          message: '학생 퇴원 처리 정책이 비활성화되어 있습니다.',
        };
      }

      const studentId = params.student_id as string;
      const date = params.date as string;
      const reason = params.reason as string | undefined;
      const settlementMode = params.settlement_mode as 'full' | 'partial' | 'none' | undefined;

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
          message: '퇴원일이 필요합니다.',
        };
      }

      // academy_students 테이블에서 status를 'withdrawn'으로 변경
      const updateData: Record<string, unknown> = {
        status: 'withdrawn',
        updated_by: context.user_id,
      };

      // Industry Adapter: 업종별 학생 테이블명 동적 조회
      const studentTableName = await getTenantTableName(context.supabase, context.tenant_id, 'student');

      if (reason) {
        // notes에 퇴원 사유 추가
        const { data: currentStudent } = await withTenant(
          context.supabase
            .from(studentTableName || 'academy_students') // Fallback
            .select('notes')
            .eq('person_id', studentId)
            .single(),
          context.tenant_id
        );

        const currentNotes = (currentStudent?.notes as string) || '';
        const dischargeNote = `[퇴원] ${date}${reason ? `: ${reason}` : ''}${settlementMode ? ` (정산: ${settlementMode})` : ''}`;
        updateData.notes = currentNotes ? `${currentNotes}\n${dischargeNote}` : dischargeNote;
      }

      const { error: updateError } = await withTenant(
        context.supabase
          .from(studentTableName || 'academy_students') // Fallback
          .update(updateData)
          .eq('person_id', studentId),
        context.tenant_id
      );

      if (updateError) {
        const maskedError = maskPII(updateError);
        console.error('[student_exec_dischargeHandler] Failed to update student status:', maskedError);
        return {
          status: 'failed',
          error_code: 'EXECUTION_FAILED',
          message: '학생 퇴원 처리에 실패했습니다.',
        };
      }

      // 모든 반 배정 해제
      const { error: unassignError } = await withTenant(
        context.supabase
          .from('student_classes')
          .update({
            is_active: false,
            left_at: date,
          })
          .eq('student_id', studentId)
          .eq('is_active', true),
        context.tenant_id
      );

      if (unassignError) {
        const maskedError = maskPII(unassignError);
        console.error('[student_exec_dischargeHandler] Failed to unassign classes:', maskedError);
        // 반 배정 해제 실패는 경고만 남기고 계속 진행
      }

      return {
        status: 'success',
        result: {
          student_id: studentId,
          status: 'withdrawn',
          date,
          settlement_mode: settlementMode,
        },
        affected_count: 1,
        message: '학생 퇴원 처리가 완료되었습니다.',
      };
    } catch (error) {
      const maskedError = maskPII(error);
      console.error('[student_exec_dischargeHandler] Execution failed:', maskedError);
      return {
        status: 'failed',
        error_code: 'EXECUTION_FAILED',
        message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
      };
    }
  },
};
