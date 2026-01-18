// LAYER: EDGE_FUNCTION_HANDLER
/**
 * 학생 반 변경 Handler
 *
 * Intent: student.exec.change_class
 * Action Key: student.change_class (Domain Action Catalog)
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

export const student_exec_change_classHandler: IntentHandler = {
  intent_key: 'student.exec.change_class',

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
      assertDomainActionKey('student.change_class');

      // ⚠️ P0: Policy 재평가 (실행 시점)
      // Domain Action 정책 경로: domain_action.student.change_class.enabled
      const policyPath = 'domain_action.student.change_class.enabled';
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
          message: '학생 반 변경 정책이 비활성화되어 있습니다.',
        };
      }

      const studentId = params.student_id as string;
      const toClassId = params.to_class_id as string;
      const effectiveDate = (params.effective_date as string) || new Date().toISOString().split('T')[0];

      if (!studentId || typeof studentId !== 'string') {
        return {
          status: 'failed',
          error_code: 'INVALID_PARAMS',
          message: '학생 ID가 필요합니다.',
        };
      }

      if (!toClassId || typeof toClassId !== 'string') {
        return {
          status: 'failed',
          error_code: 'INVALID_PARAMS',
          message: '변경할 반 ID가 필요합니다.',
        };
      }

      // 1. 현재 활성 반 배정 조회
      const { data: currentClasses, error: currentError } = await withTenant(
        context.supabase
          .from('student_classes')
          .select('id, class_id')
          .eq('student_id', studentId)
          .eq('is_active', true),
        context.tenant_id
      );

      if (currentError) {
        const maskedError = maskPII(currentError);
        console.error('[student_exec_change_classHandler] Failed to get current classes:', maskedError);
        return {
          status: 'failed',
          error_code: 'EXECUTION_FAILED',
          message: '현재 수업 정보 조회에 실패했습니다.',
        };
      }

      // 2. 기존 수업 제거 (left_at 설정)
      if (currentClasses && currentClasses.length > 0) {
        for (const currentClass of currentClasses) {
          if (currentClass.class_id !== toClassId) {
            // 다른 수업이면 left_at 설정
            const { error: unassignError } = await withTenant(
              context.supabase
                .from('student_classes')
                .update({
                  is_active: false,
                  left_at: effectiveDate,
                })
                .eq('id', currentClass.id),
              context.tenant_id
            );

            if (unassignError) {
              const maskedError = maskPII(unassignError);
              console.error('[student_exec_change_classHandler] Failed to unassign class:', maskedError);
            }
          }
        }
      }

      // 3. 새 반 배정
      // ⚠️ 중요: INSERT 쿼리는 withTenant를 사용하지 않고, row object에 tenant_id를 직접 포함
      const { data: newClass, error: assignError } = await context.supabase
        .from('student_classes')
        .insert({
          tenant_id: context.tenant_id,
          student_id: studentId,
          class_id: toClassId,
          enrolled_at: effectiveDate,
          is_active: true,
        })
        .select('id')
        .single();

      if (assignError) {
        const maskedError = maskPII(assignError);
        console.error('[student_exec_change_classHandler] Failed to assign class:', maskedError);
        return {
          status: 'failed',
          error_code: 'EXECUTION_FAILED',
          message: '반 변경에 실패했습니다.',
        };
      }

      return {
        status: 'success',
        result: {
          student_id: studentId,
          class_id: toClassId,
          effective_date: effectiveDate,
        },
        affected_count: 1,
        message: '학생 반 변경이 완료되었습니다.',
      };
    } catch (error) {
      const maskedError = maskPII(error);
      console.error('[student_exec_change_classHandler] Execution failed:', maskedError);
      return {
        status: 'failed',
        error_code: 'EXECUTION_FAILED',
        message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
      };
    }
  },
};
