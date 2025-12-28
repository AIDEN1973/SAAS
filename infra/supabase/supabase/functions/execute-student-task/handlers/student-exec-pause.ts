// LAYER: EDGE_FUNCTION_HANDLER
/**
 * 학생 휴원 처리 Handler
 *
 * Intent: student.exec.pause
 * Action Key: student.pause (Domain Action Catalog)
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

export const student_exec_pauseHandler: IntentHandler = {
  intent_key: 'student.exec.pause',

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
      assertDomainActionKey('student.pause');

      // ⚠️ P0: Policy 재평가 (실행 시점)
      // Domain Action 정책 경로: domain_action.student.pause.enabled
      const policyPath = 'domain_action.student.pause.enabled';
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
          message: '학생 휴원 처리 정책이 비활성화되어 있습니다.',
        };
      }

      const studentId = params.student_id as string;
      const from = params.from as string;
      const to = params.to as string | undefined;
      const reason = params.reason as string | undefined;

      if (!studentId || typeof studentId !== 'string') {
        return {
          status: 'failed',
          error_code: 'INVALID_PARAMS',
          message: '학생 ID가 필요합니다.',
        };
      }

      if (!from || typeof from !== 'string') {
        return {
          status: 'failed',
          error_code: 'INVALID_PARAMS',
          message: '휴원 시작일이 필요합니다.',
        };
      }

      // academy_students 테이블에서 status를 'on_leave'로 변경
      const updateData: Record<string, unknown> = {
        status: 'on_leave',
        updated_by: context.user_id,
      };

      // Industry Adapter: 업종별 학생 테이블명 동적 조회
      const studentTableName = await getTenantTableName(context.supabase, context.tenant_id, 'student');

      if (reason) {
        // notes에 휴원 사유 추가 (기존 notes와 병합)
        const { data: currentStudent } = await withTenant(
          context.supabase
            .from(studentTableName || 'academy_students') // Fallback
            .select('notes')
            .eq('person_id', studentId)
            .single(),
          context.tenant_id
        );

        const currentNotes = (currentStudent?.notes as string) || '';
        const pauseNote = `[휴원] ${from}${to ? ` ~ ${to}` : ''}${reason ? `: ${reason}` : ''}`;
        updateData.notes = currentNotes ? `${currentNotes}\n${pauseNote}` : pauseNote;
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
        console.error('[student_exec_pauseHandler] Failed to update student status:', maskedError);
        return {
          status: 'failed',
          error_code: 'EXECUTION_FAILED',
          message: '학생 휴원 처리에 실패했습니다.',
        };
      }

      return {
        status: 'success',
        result: {
          student_id: studentId,
          status: 'on_leave',
          from,
          to,
        },
        affected_count: 1,
        message: '학생 휴원 처리가 완료되었습니다.',
      };
    } catch (error) {
      const maskedError = maskPII(error);
      console.error('[student_exec_pauseHandler] Execution failed:', maskedError);
      return {
        status: 'failed',
        error_code: 'EXECUTION_FAILED',
        message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
      };
    }
  },
};
