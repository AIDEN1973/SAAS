// LAYER: EDGE_FUNCTION_HANDLER
/**
 * 학생 일괄 수정 Handler
 *
 * Intent: student.exec.bulk_update
 * Action Key: student.bulk_update (Domain Action Catalog)
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

export const student_exec_bulk_updateHandler: IntentHandler = {
  intent_key: 'student.exec.bulk_update',

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
      assertDomainActionKey('student.bulk_update');

      // ⚠️ P0: Policy 재평가 (실행 시점)
      // Domain Action 정책 경로: domain_action.student.bulk_update.enabled
      const policyPath = 'domain_action.student.bulk_update.enabled';
      const policyEnabled = await getTenantSettingByPath(
        context.supabase,
        context.tenant_id,
        policyPath
      );

      if (!policyEnabled || policyEnabled !== true) {
        return {
          status: 'failed',
          error_code: 'POLICY_DISABLED',
          message: '학생 일괄 수정 정책이 비활성화되어 있습니다.',
        };
      }

      const updates = params.updates as Array<{ student_id: string; patch: Record<string, unknown> }>;

      if (!updates || !Array.isArray(updates) || updates.length === 0) {
        return {
          status: 'failed',
          error_code: 'INVALID_PARAMS',
          message: '수정할 학생 정보가 필요합니다.',
        };
      }

      let successCount = 0;
      const errors: string[] = [];

      for (let i = 0; i < updates.length; i++) {
        const update = updates[i];
        if (!update || typeof update !== 'object') continue;

        const studentId = update.student_id as string;
        const patch = update.patch as Record<string, unknown>;

        if (!studentId || typeof studentId !== 'string') {
          errors.push(`행 ${i + 1}: 학생 ID가 필요합니다.`);
          continue;
        }

        if (!patch || typeof patch !== 'object') {
          errors.push(`행 ${i + 1}: 수정할 정보가 필요합니다.`);
          continue;
        }

        try {
          // persons 테이블 업데이트 (공통 필드)
          const personUpdate: Record<string, unknown> = {};
          if (patch.name !== undefined) personUpdate.name = patch.name;
          if (patch.email !== undefined) personUpdate.email = patch.email;
          if (patch.phone !== undefined) personUpdate.phone = patch.phone;
          if (patch.address !== undefined) personUpdate.address = patch.address;

          if (Object.keys(personUpdate).length > 0) {
            const { error: personError } = await withTenant(
              context.supabase
                .from('persons')
                .update(personUpdate)
                .eq('id', studentId),
              context.tenant_id
            );

            if (personError) {
              const maskedError = maskPII(personError);
              console.error(`[student_exec_bulk_updateHandler] Row ${i + 1} failed to update person:`, maskedError);
              errors.push(`행 ${i + 1}: 기본 정보 수정 실패`);
              continue;
            }
          }

          // academy_students 테이블 업데이트 (학원 전용 필드)
          const academyUpdate: Record<string, unknown> = {};
          if (patch.birth_date !== undefined) academyUpdate.birth_date = patch.birth_date;
          if (patch.gender !== undefined) academyUpdate.gender = patch.gender;
          if (patch.school_name !== undefined) academyUpdate.school_name = patch.school_name;
          if (patch.grade !== undefined) academyUpdate.grade = patch.grade;
          if (patch.status !== undefined) academyUpdate.status = patch.status;
          if (patch.notes !== undefined) academyUpdate.notes = patch.notes;
          academyUpdate.updated_by = context.user_id;

          // Industry Adapter: 업종별 학생 테이블명 동적 조회
          const studentTableName = await getTenantTableName(context.supabase, context.tenant_id, 'student');

          if (Object.keys(academyUpdate).length > 0) {
            const { error: academyError } = await withTenant(
              context.supabase
                .from(studentTableName || 'academy_students') // Fallback
                .update(academyUpdate)
                .eq('person_id', studentId),
              context.tenant_id
            );

            if (academyError) {
              const maskedError = maskPII(academyError);
              console.error(`[student_exec_bulk_updateHandler] Row ${i + 1} failed to update academy student:`, maskedError);
              errors.push(`행 ${i + 1}: 프로필 수정 실패`);
              continue;
            }
          }

          successCount++;
        } catch (error) {
          const maskedError = maskPII(error);
          console.error(`[student_exec_bulk_updateHandler] Row ${i + 1} error:`, maskedError);
          errors.push(`행 ${i + 1}: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
        }
      }

      if (successCount === 0) {
        return {
          status: 'failed',
          error_code: 'EXECUTION_FAILED',
          message: errors.length > 0 ? errors.join(', ') : '학생 일괄 수정에 실패했습니다.',
        };
      }

      return {
        status: errors.length > 0 ? 'partial' : 'success',
        result: {
          total_count: updates.length,
          success_count: successCount,
          error_count: errors.length,
        },
        affected_count: successCount,
        message: `${successCount}개 학생 수정이 완료되었습니다.${errors.length > 0 ? ` (${errors.length}개 실패)` : ''}`,
      };
    } catch (error) {
      const maskedError = maskPII(error);
      console.error('[student_exec_bulk_updateHandler] Execution failed:', maskedError);
      return {
        status: 'failed',
        error_code: 'EXECUTION_FAILED',
        message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
      };
    }
  },
};
