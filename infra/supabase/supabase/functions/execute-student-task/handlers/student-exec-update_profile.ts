// LAYER: EDGE_FUNCTION_HANDLER
/**
 * 학생 프로필 수정 Handler
 *
 * Intent: student.exec.update_profile
 * Action Key: student.update_profile (Domain Action Catalog)
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

export const student_exec_update_profileHandler: IntentHandler = {
  intent_key: 'student.exec.update_profile',

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
      assertDomainActionKey('student.update_profile');

      // ⚠️ P0: Policy 재평가 (실행 시점)
      // Domain Action 정책 경로: domain_action.student.update_profile.enabled
      const policyPath = 'domain_action.student.update_profile.enabled';
      const policyEnabled = await getTenantSettingByPath(
        context.supabase,
        context.tenant_id,
        policyPath
      );

      if (!policyEnabled || policyEnabled !== true) {
        return {
          status: 'failed',
          error_code: 'POLICY_DISABLED',
          message: '학생 프로필 수정 정책이 비활성화되어 있습니다.',
        };
      }

      const studentId = params.student_id as string;
      const patch = params.patch as Record<string, unknown>;

      if (!studentId || typeof studentId !== 'string') {
        return {
          status: 'failed',
          error_code: 'INVALID_PARAMS',
          message: '학생 ID가 필요합니다.',
        };
      }

      if (!patch || typeof patch !== 'object') {
        return {
          status: 'failed',
          error_code: 'INVALID_PARAMS',
          message: '수정할 정보가 필요합니다.',
        };
      }

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
          console.error('[student_exec_update_profileHandler] Failed to update person:', maskedError);
          return {
            status: 'failed',
            error_code: 'EXECUTION_FAILED',
            message: '학생 기본 정보 수정에 실패했습니다.',
          };
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
      if (patch.profile_image_url !== undefined) academyUpdate.profile_image_url = patch.profile_image_url;
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
          console.error('[student_exec_update_profileHandler] Failed to update academy student:', maskedError);
          return {
            status: 'failed',
            error_code: 'EXECUTION_FAILED',
            message: '학생 프로필 수정에 실패했습니다.',
          };
        }
      }

      return {
        status: 'success',
        result: {
          student_id: studentId,
          message: '학생 프로필 수정이 완료되었습니다.',
        },
        affected_count: 1,
        message: '학생 프로필 수정이 완료되었습니다.',
      };
    } catch (error) {
      const maskedError = maskPII(error);
      console.error('[student_exec_update_profileHandler] Execution failed:', maskedError);
      return {
        status: 'failed',
        error_code: 'EXECUTION_FAILED',
        message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
      };
    }
  },
};
