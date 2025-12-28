// LAYER: EDGE_FUNCTION_HANDLER
/**
 * 반 마감 Handler
 *
 * Intent: class.exec.close
 * Action Key: class.close (Domain Action Catalog)
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

export const class_exec_closeHandler: IntentHandler = {
  intent_key: 'class.exec.close',

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
      assertDomainActionKey('class.close');

      // ⚠️ P0: Policy 재평가 (실행 시점)
      // Domain Action 정책 경로: domain_action.class.close.enabled
      const policyPath = 'domain_action.class.close.enabled';
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
          message: '반 마감 정책이 비활성화되어 있습니다.',
        };
      }

      const classId = params.class_id as string;

      if (!classId || typeof classId !== 'string') {
        return {
          status: 'failed',
          error_code: 'INVALID_PARAMS',
          message: '반 ID가 필요합니다.',
        };
      }

      // Industry Adapter: 업종별 클래스 테이블명 동적 조회
      const classTableName = await getTenantTableName(context.supabase, context.tenant_id, 'class');

      // 반 상태를 'archived'로 변경
      const { error: updateError } = await withTenant(
        context.supabase
          .from(classTableName || 'academy_classes') // Fallback
          .update({
            status: 'archived',
            updated_by: context.user_id,
          })
          .eq('id', classId),
        context.tenant_id
      );

      if (updateError) {
        const maskedError = maskPII(updateError);
        console.error('[class_exec_closeHandler] Failed to close class:', maskedError);
        return {
          status: 'failed',
          error_code: 'EXECUTION_FAILED',
          message: '반 마감에 실패했습니다.',
        };
      }

      return {
        status: 'success',
        result: {
          class_id: classId,
          status: 'archived',
        },
        affected_count: 1,
        message: '반 마감이 완료되었습니다.',
      };
    } catch (error) {
      const maskedError = maskPII(error);
      console.error('[class_exec_closeHandler] Execution failed:', maskedError);
      return {
        status: 'failed',
        error_code: 'EXECUTION_FAILED',
        message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
      };
    }
  },
};
