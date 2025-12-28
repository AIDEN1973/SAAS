// LAYER: EDGE_FUNCTION_HANDLER
/**
 * 월 마감 Handler
 *
 * Intent: billing.exec.close_month
 * Action Key: billing.close_month (Domain Action Catalog)
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

export const billing_exec_close_monthHandler: IntentHandler = {
  intent_key: 'billing.exec.close_month',

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
      assertDomainActionKey('billing.close_month');

      // ⚠️ P0: Policy 재평가 (실행 시점)
      // Domain Action 정책 경로: domain_action.billing.close_month.enabled
      const policyPath = 'domain_action.billing.close_month.enabled';
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
          message: '월 마감 정책이 비활성화되어 있습니다.',
        };
      }

      const month = params.month as string;

      if (!month || typeof month !== 'string') {
        return {
          status: 'failed',
          error_code: 'INVALID_PARAMS',
          message: '월(YYYY-MM)이 필요합니다.',
        };
      }

      // 해당 월의 청구서 조회
      const periodStart = `${month}-01`;
      const [year, monthNum] = month.split('-').map(Number);
      const lastDay = new Date(year, monthNum, 0).getDate();
      const periodEnd = `${month}-${String(lastDay).padStart(2, '0')}`;

      // 미결제 청구서를 overdue로 변경
      const { data: unpaidInvoices, error: queryError } = await withTenant(
        context.supabase
          .from('invoices')
          .select('id')
          .gte('period_start', periodStart)
          .lte('period_start', periodEnd)
          .in('status', ['draft', 'issued'])
          .lt('due_date', periodEnd),
        context.tenant_id
      );

      if (queryError) {
        const maskedError = maskPII(queryError);
        console.error('[billing_exec_close_monthHandler] Failed to query invoices:', maskedError);
        return {
          status: 'failed',
          error_code: 'EXECUTION_FAILED',
          message: '청구서 조회에 실패했습니다.',
        };
      }

      let updatedCount = 0;
      if (unpaidInvoices && unpaidInvoices.length > 0) {
        for (const invoice of unpaidInvoices) {
          const { error: updateError } = await withTenant(
            context.supabase
              .from('invoices')
              .update({ status: 'overdue' })
              .eq('id', invoice.id),
            context.tenant_id
          );

          if (updateError) {
            const maskedError = maskPII(updateError);
            console.error('[billing_exec_close_monthHandler] Failed to update invoice:', maskedError);
          } else {
            updatedCount++;
          }
        }
      }

      return {
        status: 'success',
        result: {
          month,
          updated_count: updatedCount,
        },
        affected_count: updatedCount,
        message: `${month}월 마감이 완료되었습니다. (${updatedCount}개 청구서 상태 변경)`,
      };
    } catch (error) {
      const maskedError = maskPII(error);
      console.error('[billing_exec_close_monthHandler] Execution failed:', maskedError);
      return {
        status: 'failed',
        error_code: 'EXECUTION_FAILED',
        message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
      };
    }
  },
};
