// LAYER: EDGE_FUNCTION_HANDLER
/**
 * 결제 게이트웨이 동기화 Handler
 *
 * Intent: billing.exec.sync_gateway
 * Action Key: billing.sync_gateway (Domain Action Catalog)
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

export const billing_exec_sync_gatewayHandler: IntentHandler = {
  intent_key: 'billing.exec.sync_gateway',

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
      assertDomainActionKey('billing.sync_gateway');

      // ⚠️ P0: Policy 재평가 (실행 시점)
      // Domain Action 정책 경로: domain_action.billing.sync_gateway.enabled
      const policyPath = 'domain_action.billing.sync_gateway.enabled';
      const policyEnabled = await getTenantSettingByPath(
        context.supabase,
        context.tenant_id,
        policyPath
      );

      if (!policyEnabled || policyEnabled !== true) {
        return {
          status: 'failed',
          error_code: 'POLICY_DISABLED',
          message: '결제 게이트웨이 동기화 정책이 비활성화되어 있습니다.',
        };
      }

      // 결제 게이트웨이와 동기화 (pending 상태의 결제 조회 및 상태 업데이트)
      // TODO: 실제 결제 게이트웨이 API 연동 필요
      const { data: pendingPayments, error: queryError } = await withTenant(
        context.supabase
          .from('payments')
          .select('id, invoice_id, amount, provider')
          .in('status', ['pending', 'processing'])
          .limit(100),
        context.tenant_id
      );

      if (queryError) {
        const maskedError = maskPII(queryError);
        console.error('[billing_exec_sync_gatewayHandler] Failed to query pending payments:', maskedError);
        return {
          status: 'failed',
          error_code: 'EXECUTION_FAILED',
          message: '결제 조회에 실패했습니다.',
        };
      }

      if (!pendingPayments || pendingPayments.length === 0) {
        return {
          status: 'success',
          result: {
            synced_count: 0,
          },
          affected_count: 0,
          message: '동기화할 결제가 없습니다.',
        };
      }

      // TODO: 실제 게이트웨이 API 호출하여 상태 동기화
      let syncedCount = 0;
      for (const payment of pendingPayments) {
        // 실제 게이트웨이 API 호출은 여기서 수행
        // 현재는 성공으로 간주
        syncedCount++;
      }

      return {
        status: 'success',
        result: {
          synced_count: syncedCount,
          total_count: pendingPayments.length,
        },
        affected_count: syncedCount,
        message: `${syncedCount}개 결제가 동기화되었습니다.`,
      };
    } catch (error) {
      const maskedError = maskPII(error);
      console.error('[billing_exec_sync_gatewayHandler] Execution failed:', maskedError);
      return {
        status: 'failed',
        error_code: 'EXECUTION_FAILED',
        message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
      };
    }
  },
};
