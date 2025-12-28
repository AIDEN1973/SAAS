// LAYER: EDGE_FUNCTION_HANDLER
/**
 * 보호자 연락처 수정 Handler
 *
 * Intent: student.exec.update_guardian_contact
 * Action Key: student.update_guardian_contact (Domain Action Catalog)
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

export const student_exec_update_guardian_contactHandler: IntentHandler = {
  intent_key: 'student.exec.update_guardian_contact',

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
      assertDomainActionKey('student.update_guardian_contact');

      // ⚠️ P0: Policy 재평가 (실행 시점)
      // Domain Action 정책 경로: domain_action.student.update_guardian_contact.enabled
      const policyPath = 'domain_action.student.update_guardian_contact.enabled';
      const policyEnabled = await getTenantSettingByPath(
        context.supabase,
        context.tenant_id,
        policyPath
      );

      if (!policyEnabled || policyEnabled !== true) {
        return {
          status: 'failed',
          error_code: 'POLICY_DISABLED',
          message: '보호자 연락처 수정 정책이 비활성화되어 있습니다.',
        };
      }

      const studentId = params.student_id as string;
      const guardianName = params.guardian_name as string | undefined;
      const guardianPhone = params.guardian_phone as string | undefined;
      const guardianEmail = params.guardian_email as string | undefined;

      if (!studentId || typeof studentId !== 'string') {
        return {
          status: 'failed',
          error_code: 'INVALID_PARAMS',
          message: '학생 ID가 필요합니다.',
        };
      }

      // 보호자 조회 (주 보호자 우선, 없으면 첫 번째 보호자)
      const { data: guardians, error: guardianError } = await withTenant(
        context.supabase
          .from('guardians')
          .select('id, name, phone, email, is_primary')
          .eq('student_id', studentId)
          .order('is_primary', { ascending: false })
          .limit(1),
        context.tenant_id
      );

      if (guardianError || !guardians || guardians.length === 0) {
        // 보호자가 없으면 새로 생성
        if (!guardianName || !guardianPhone) {
          return {
            status: 'failed',
            error_code: 'INVALID_PARAMS',
            message: '보호자 이름과 전화번호가 필요합니다.',
          };
        }

        const { error: createError } = await withTenant(
          context.supabase
            .from('guardians')
            .insert({
              tenant_id: context.tenant_id,
              student_id: studentId,
              name: guardianName,
              phone: guardianPhone,
              email: guardianEmail || null,
              relationship: 'guardian',
              is_primary: true,
            }),
          context.tenant_id
        );

        if (createError) {
          const maskedError = maskPII(createError);
          console.error('[student_exec_update_guardian_contactHandler] Failed to create guardian:', maskedError);
          return {
            status: 'failed',
            error_code: 'EXECUTION_FAILED',
            message: '보호자 정보 생성에 실패했습니다.',
          };
        }

        return {
          status: 'success',
          result: {
            student_id: studentId,
            message: '보호자 정보가 생성되었습니다.',
          },
          affected_count: 1,
          message: '보호자 정보가 생성되었습니다.',
        };
      }

      // 기존 보호자 정보 업데이트
      const guardian = guardians[0];
      const updateData: Record<string, unknown> = {};

      if (guardianName !== undefined) updateData.name = guardianName;
      if (guardianPhone !== undefined) updateData.phone = guardianPhone;
      if (guardianEmail !== undefined) updateData.email = guardianEmail;

      if (Object.keys(updateData).length === 0) {
        return {
          status: 'failed',
          error_code: 'INVALID_PARAMS',
          message: '수정할 정보가 필요합니다.',
        };
      }

      const { error: updateError } = await withTenant(
        context.supabase
          .from('guardians')
          .update(updateData)
          .eq('id', guardian.id),
        context.tenant_id
      );

      if (updateError) {
        const maskedError = maskPII(updateError);
        console.error('[student_exec_update_guardian_contactHandler] Failed to update guardian:', maskedError);
        return {
          status: 'failed',
          error_code: 'EXECUTION_FAILED',
          message: '보호자 연락처 수정에 실패했습니다.',
        };
      }

      return {
        status: 'success',
        result: {
          student_id: studentId,
          guardian_id: guardian.id,
        },
        affected_count: 1,
        message: '보호자 연락처 수정이 완료되었습니다.',
      };
    } catch (error) {
      const maskedError = maskPII(error);
      console.error('[student_exec_update_guardian_contactHandler] Execution failed:', maskedError);
      return {
        status: 'failed',
        error_code: 'EXECUTION_FAILED',
        message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
      };
    }
  },
};
