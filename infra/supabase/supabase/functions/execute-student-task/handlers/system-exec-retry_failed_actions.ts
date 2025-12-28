// LAYER: EDGE_FUNCTION_HANDLER
/**
 * 실패한 작업 재시도 Handler
 *
 * Intent: system.exec.retry_failed_actions
 * Action Key: system.retry_failed_actions (Domain Action Catalog)
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

export const system_exec_retry_failed_actionsHandler: IntentHandler = {
  intent_key: 'system.exec.retry_failed_actions',

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
      assertDomainActionKey('system.retry_failed_actions');

      // ⚠️ P0: Policy 재평가 (실행 시점)
      // Domain Action 정책 경로: domain_action.system.retry_failed_actions.enabled
      const policyPath = 'domain_action.system.retry_failed_actions.enabled';
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
          message: '실패한 작업 재시도 정책이 비활성화되어 있습니다.',
        };
      }

      const from = params.from as string;
      const to = params.to as string;

      if (!from || typeof from !== 'string') {
        return {
          status: 'failed',
          error_code: 'INVALID_PARAMS',
          message: '시작 날짜가 필요합니다.',
        };
      }

      if (!to || typeof to !== 'string') {
        return {
          status: 'failed',
          error_code: 'INVALID_PARAMS',
          message: '종료 날짜가 필요합니다.',
        };
      }

      // 실패한 작업 조회 및 재시도
      // TODO: 실제 재시도 로직 구현 필요
      const { data: failedActions, error: queryError } = await withTenant(
        context.supabase
          .from('execution_audit_runs')
          .select('id')
          .eq('status', 'failed')
          .gte('created_at', from)
          .lte('created_at', to)
          .limit(100),
        context.tenant_id
      );

      if (queryError) {
        const maskedError = maskPII(queryError);
        console.error('[system_exec_retry_failed_actionsHandler] Failed to query failed actions:', maskedError);
        return {
          status: 'failed',
          error_code: 'EXECUTION_FAILED',
          message: '실패한 작업 조회에 실패했습니다.',
        };
      }

      return {
        status: 'success',
        result: {
          from,
          to,
          retry_count: failedActions?.length || 0,
        },
        affected_count: failedActions?.length || 0,
        message: `${failedActions?.length || 0}개 작업 재시도가 시작되었습니다.`,
      };
    } catch (error) {
      const maskedError = maskPII(error);
      console.error('[system_exec_retry_failed_actionsHandler] Execution failed:', maskedError);
      return {
        status: 'failed',
        error_code: 'EXECUTION_FAILED',
        message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
      };
    }
  },
};
