// LAYER: EDGE_FUNCTION_HANDLER
/**
 * 상담일지 생성 Handler
 *
 * Intent: note.exec.create
 * Action Key: note.create (Domain Action Catalog)
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

export const note_exec_createHandler: IntentHandler = {
  intent_key: 'note.exec.create',

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
      assertDomainActionKey('note.create');

      // ⚠️ P0: Policy 재평가 (실행 시점)
      // Domain Action 정책 경로: domain_action.note.create.enabled
      const policyPath = 'domain_action.note.create.enabled';
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
          message: '상담일지 생성 정책이 비활성화되어 있습니다.',
        };
      }

      const studentId = params.student_id as string;
      const type = params.type as string;
      const content = params.content as string;

      if (!studentId || typeof studentId !== 'string') {
        return {
          status: 'failed',
          error_code: 'INVALID_PARAMS',
          message: '학생 ID가 필요합니다.',
        };
      }

      if (!type || typeof type !== 'string') {
        return {
          status: 'failed',
          error_code: 'INVALID_PARAMS',
          message: '상담 유형이 필요합니다.',
        };
      }

      if (!content || typeof content !== 'string') {
        return {
          status: 'failed',
          error_code: 'INVALID_PARAMS',
          message: '상담 내용이 필요합니다.',
        };
      }

      // 상담일지 생성
      // ⚠️ 중요: INSERT 쿼리는 withTenant를 사용하지 않고, row object에 tenant_id를 직접 포함
      const { data: consultation, error: createError } = await context.supabase
        .from('student_consultations')
        .insert({
          tenant_id: context.tenant_id,
          student_id: studentId,
          consultation_type: type,
          content,
          created_by: context.user_id,
        })
        .select('id')
        .single();

      if (createError) {
        const maskedError = maskPII(createError);
        console.error('[note_exec_createHandler] Failed to create consultation:', maskedError);
        return {
          status: 'failed',
          error_code: 'EXECUTION_FAILED',
          message: '상담일지 생성에 실패했습니다.',
        };
      }

      return {
        status: 'success',
        result: {
          consultation_id: consultation.id,
          student_id: studentId,
        },
        affected_count: 1,
        message: '상담일지 생성이 완료되었습니다.',
      };
    } catch (error) {
      const maskedError = maskPII(error);
      console.error('[note_exec_createHandler] Execution failed:', maskedError);
      return {
        status: 'failed',
        error_code: 'EXECUTION_FAILED',
        message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
      };
    }
  },
};
