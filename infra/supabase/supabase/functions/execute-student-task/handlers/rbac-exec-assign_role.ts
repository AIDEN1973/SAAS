// LAYER: EDGE_FUNCTION_HANDLER
/**
 * 역할 할당 Handler
 *
 * Intent: rbac.exec.assign_role
 * Action Key: rbac.assign_role (Domain Action Catalog)
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

export const rbac_exec_assign_roleHandler: IntentHandler = {
  intent_key: 'rbac.exec.assign_role',

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
      assertDomainActionKey('rbac.assign_role');

      // ⚠️ P0: Policy 재평가 (실행 시점)
      // Domain Action 정책 경로: domain_action.rbac.assign_role.enabled
      const policyPath = 'domain_action.rbac.assign_role.enabled';
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
          message: '역할 할당 정책이 비활성화되어 있습니다.',
        };
      }

      const userId = params.user_id as string;
      const role = params.role as string;

      if (!userId || typeof userId !== 'string') {
        return {
          status: 'failed',
          error_code: 'INVALID_PARAMS',
          message: '사용자 ID가 필요합니다.',
        };
      }

      if (!role || typeof role !== 'string') {
        return {
          status: 'failed',
          error_code: 'INVALID_PARAMS',
          message: '역할이 필요합니다.',
        };
      }

      // 역할 할당 (user_roles 테이블에 저장)
      // TODO: 실제 user_roles 테이블 구조 확인 필요
      const { data: userRole, error: assignError } = await withTenant(
        context.supabase
          .from('user_roles')
          .upsert({
            tenant_id: context.tenant_id,
            user_id: userId,
            role,
          })
          .select('id')
          .single(),
        context.tenant_id
      );

      if (assignError) {
        const maskedError = maskPII(assignError);
        console.error('[rbac_exec_assign_roleHandler] Failed to assign role:', maskedError);
        return {
          status: 'failed',
          error_code: 'EXECUTION_FAILED',
          message: '역할 할당에 실패했습니다.',
        };
      }

      return {
        status: 'success',
        result: {
          user_id: userId,
          role,
        },
        affected_count: 1,
        message: '역할 할당이 완료되었습니다.',
      };
    } catch (error) {
      const maskedError = maskPII(error);
      console.error('[rbac_exec_assign_roleHandler] Execution failed:', maskedError);
      return {
        status: 'failed',
        error_code: 'EXECUTION_FAILED',
        message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
      };
    }
  },
};
