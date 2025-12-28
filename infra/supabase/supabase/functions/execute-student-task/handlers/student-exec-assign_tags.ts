// LAYER: EDGE_FUNCTION_HANDLER
/**
 * 학생 태그 할당 Handler
 *
 * Intent: student.exec.assign_tags
 * Action Key: student.assign_tags (Domain Action Catalog)
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

export const student_exec_assign_tagsHandler: IntentHandler = {
  intent_key: 'student.exec.assign_tags',

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
      assertDomainActionKey('student.assign_tags');

      // ⚠️ P0: Policy 재평가 (실행 시점)
      // Domain Action 정책 경로: domain_action.student.assign_tags.enabled
      const policyPath = 'domain_action.student.assign_tags.enabled';
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
          message: '학생 태그 할당 정책이 비활성화되어 있습니다.',
        };
      }

      const studentId = params.student_id as string;
      const tags = params.tags as string[];

      if (!studentId || typeof studentId !== 'string') {
        return {
          status: 'failed',
          error_code: 'INVALID_PARAMS',
          message: '학생 ID가 필요합니다.',
        };
      }

      if (!tags || !Array.isArray(tags) || tags.length === 0) {
        return {
          status: 'failed',
          error_code: 'INVALID_PARAMS',
          message: '태그 목록이 필요합니다.',
        };
      }

      // 태그 할당 (중복은 무시)
      let successCount = 0;
      const errors: string[] = [];

      for (const tagId of tags) {
        if (typeof tagId !== 'string') continue;

        // ⚠️ 중요: INSERT 쿼리는 withTenant를 사용하지 않고, row object에 tenant_id를 직접 포함
        const { error: assignError } = await context.supabase
          .from('tag_assignments')
          .insert({
            tenant_id: context.tenant_id,
            entity_id: studentId,
            entity_type: 'student',
            tag_id: tagId,
          });

        if (assignError) {
          // 중복 할당 오류는 무시 (이미 할당된 경우)
          const isDuplicateError = assignError.code === '23505' ||
            assignError.message?.includes('duplicate key') ||
            assignError.message?.includes('unique constraint');

          if (!isDuplicateError) {
            const maskedError = maskPII(assignError);
            console.error('[student_exec_assign_tagsHandler] Failed to assign tag:', maskedError);
            errors.push(`태그 ${tagId} 할당 실패`);
          } else {
            successCount++; // 중복은 성공으로 간주
          }
        } else {
          successCount++;
        }
      }

      if (successCount === 0) {
        return {
          status: 'failed',
          error_code: 'EXECUTION_FAILED',
          message: errors.length > 0 ? errors.join(', ') : '태그 할당에 실패했습니다.',
        };
      }

      return {
        status: errors.length > 0 ? 'partial' : 'success',
        result: {
          student_id: studentId,
          assigned_count: successCount,
          total_count: tags.length,
        },
        affected_count: successCount,
        message: `${successCount}개 태그 할당이 완료되었습니다.${errors.length > 0 ? ` (${errors.length}개 실패)` : ''}`,
      };
    } catch (error) {
      const maskedError = maskPII(error);
      console.error('[student_exec_assign_tagsHandler] Execution failed:', maskedError);
      return {
        status: 'failed',
        error_code: 'EXECUTION_FAILED',
        message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
      };
    }
  },
};
