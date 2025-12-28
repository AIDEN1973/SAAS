// LAYER: EDGE_FUNCTION_HANDLER
/**
 * 중복 학생 병합 Handler
 *
 * Intent: student.exec.merge_duplicates
 * Action Key: student.merge_duplicates (Domain Action Catalog)
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

export const student_exec_merge_duplicatesHandler: IntentHandler = {
  intent_key: 'student.exec.merge_duplicates',

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
      assertDomainActionKey('student.merge_duplicates');

      // ⚠️ P0: Policy 재평가 (실행 시점)
      // Domain Action 정책 경로: domain_action.student.merge_duplicates.enabled
      const policyPath = 'domain_action.student.merge_duplicates.enabled';
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
          message: '중복 학생 병합 정책이 비활성화되어 있습니다.',
        };
      }

      const primaryStudentId = params.primary_student_id as string;
      const duplicateStudentId = params.duplicate_student_id as string;

      if (!primaryStudentId || typeof primaryStudentId !== 'string') {
        return {
          status: 'failed',
          error_code: 'INVALID_PARAMS',
          message: '주 학생 ID가 필요합니다.',
        };
      }

      if (!duplicateStudentId || typeof duplicateStudentId !== 'string') {
        return {
          status: 'failed',
          error_code: 'INVALID_PARAMS',
          message: '중복 학생 ID가 필요합니다.',
        };
      }

      if (primaryStudentId === duplicateStudentId) {
        return {
          status: 'failed',
          error_code: 'INVALID_PARAMS',
          message: '주 학생과 중복 학생이 동일합니다.',
        };
      }

      // 중복 학생의 데이터를 주 학생으로 병합
      // 1. student_classes 업데이트 (duplicate -> primary)
      const { error: classError } = await withTenant(
        context.supabase
          .from('student_classes')
          .update({ student_id: primaryStudentId })
          .eq('student_id', duplicateStudentId),
        context.tenant_id
      );

      if (classError) {
        const maskedError = maskPII(classError);
        console.error('[student_exec_merge_duplicatesHandler] Failed to update student_classes:', maskedError);
      }

      // 2. guardians 업데이트 (duplicate -> primary)
      const { error: guardianError } = await withTenant(
        context.supabase
          .from('guardians')
          .update({ student_id: primaryStudentId })
          .eq('student_id', duplicateStudentId),
        context.tenant_id
      );

      if (guardianError) {
        const maskedError = maskPII(guardianError);
        console.error('[student_exec_merge_duplicatesHandler] Failed to update guardians:', maskedError);
      }

      // 3. attendance_logs 업데이트 (duplicate -> primary)
      const { error: attendanceError } = await withTenant(
        context.supabase
          .from('attendance_logs')
          .update({ student_id: primaryStudentId })
          .eq('student_id', duplicateStudentId),
        context.tenant_id
      );

      if (attendanceError) {
        const maskedError = maskPII(attendanceError);
        console.error('[student_exec_merge_duplicatesHandler] Failed to update attendance_logs:', maskedError);
      }

      // 4. tag_assignments 업데이트 (duplicate -> primary)
      const { error: tagError } = await withTenant(
        context.supabase
          .from('tag_assignments')
          .update({ entity_id: primaryStudentId })
          .eq('entity_id', duplicateStudentId)
          .eq('entity_type', 'student'),
        context.tenant_id
      );

      if (tagError) {
        const maskedError = maskPII(tagError);
        console.error('[student_exec_merge_duplicatesHandler] Failed to update tag_assignments:', maskedError);
      }

      // Industry Adapter: 업종별 학생 테이블명 동적 조회
      const studentTableName = await getTenantTableName(context.supabase, context.tenant_id, 'student');

      // 5. 중복 학생 삭제 (soft delete: status를 'withdrawn'으로 변경)
      const { error: deleteError } = await withTenant(
        context.supabase
          .from(studentTableName || 'academy_students') // Fallback
          .update({ status: 'withdrawn' })
          .eq('person_id', duplicateStudentId),
        context.tenant_id
      );

      if (deleteError) {
        const maskedError = maskPII(deleteError);
        console.error('[student_exec_merge_duplicatesHandler] Failed to delete duplicate student:', maskedError);
        return {
          status: 'failed',
          error_code: 'EXECUTION_FAILED',
          message: '중복 학생 병합에 실패했습니다.',
        };
      }

      return {
        status: 'success',
        result: {
          primary_student_id: primaryStudentId,
          duplicate_student_id: duplicateStudentId,
        },
        affected_count: 1,
        message: '중복 학생 병합이 완료되었습니다.',
      };
    } catch (error) {
      const maskedError = maskPII(error);
      console.error('[student_exec_merge_duplicatesHandler] Execution failed:', maskedError);
      return {
        status: 'failed',
        error_code: 'EXECUTION_FAILED',
        message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
      };
    }
  },
};
