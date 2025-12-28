// LAYER: EDGE_FUNCTION_HANDLER
/**
 * 할인 적용 Handler
 *
 * Intent: billing.exec.apply_discount
 * Action Key: billing.apply_discount (Domain Action Catalog)
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

export const billing_exec_apply_discountHandler: IntentHandler = {
  intent_key: 'billing.exec.apply_discount',

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
      assertDomainActionKey('billing.apply_discount');

      // ⚠️ P0: Policy 재평가 (실행 시점)
      // Domain Action 정책 경로: domain_action.billing.apply_discount.enabled
      const policyPath = 'domain_action.billing.apply_discount.enabled';
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
          message: '할인 적용 정책이 비활성화되어 있습니다.',
        };
      }

      const studentId = params.student_id as string;
      const month = params.month as string;
      const amount = params.amount as number;
      const reason = params.reason as string | undefined;

      if (!studentId || typeof studentId !== 'string') {
        return {
          status: 'failed',
          error_code: 'INVALID_PARAMS',
          message: '학생 ID가 필요합니다.',
        };
      }

      if (!month || typeof month !== 'string') {
        return {
          status: 'failed',
          error_code: 'INVALID_PARAMS',
          message: '월(YYYY-MM)이 필요합니다.',
        };
      }

      if (!amount || typeof amount !== 'number' || amount <= 0) {
        return {
          status: 'failed',
          error_code: 'INVALID_PARAMS',
          message: '할인 금액이 필요합니다.',
        };
      }

      // 해당 월의 청구서 조회
      const periodStart = `${month}-01`;
      const [year, monthNum] = month.split('-').map(Number);
      const lastDay = new Date(year, monthNum, 0).getDate();
      const periodEnd = `${month}-${String(lastDay).padStart(2, '0')}`;

      const { data: invoice, error: invoiceError } = await withTenant(
        context.supabase
          .from('invoices')
          .select('id, amount')
          .eq('payer_id', studentId)
          .gte('period_start', periodStart)
          .lte('period_start', periodEnd)
          .single(),
        context.tenant_id
      );

      if (invoiceError || !invoice) {
        const maskedError = maskPII(invoiceError);
        console.error('[billing_exec_apply_discountHandler] Failed to query invoice:', maskedError);
        return {
          status: 'failed',
          error_code: 'NOT_FOUND',
          message: '해당 월의 청구서를 찾을 수 없습니다.',
        };
      }

      // 할인 적용 (amount 감소)
      const newAmount = Math.max(0, (invoice.amount as number) - amount);

      const { error: updateError } = await withTenant(
        context.supabase
          .from('invoices')
          .update({
            amount: newAmount,
            notes: reason ? `할인: ${amount}원${reason ? ` (${reason})` : ''}` : `할인: ${amount}원`,
          })
          .eq('id', invoice.id),
        context.tenant_id
      );

      if (updateError) {
        const maskedError = maskPII(updateError);
        console.error('[billing_exec_apply_discountHandler] Failed to update invoice:', maskedError);
        return {
          status: 'failed',
          error_code: 'EXECUTION_FAILED',
          message: '할인 적용에 실패했습니다.',
        };
      }

      return {
        status: 'success',
        result: {
          invoice_id: invoice.id,
          original_amount: invoice.amount,
          discount_amount: amount,
          new_amount: newAmount,
        },
        affected_count: 1,
        message: `${amount}원 할인이 적용되었습니다.`,
      };
    } catch (error) {
      const maskedError = maskPII(error);
      console.error('[billing_exec_apply_discountHandler] Execution failed:', maskedError);
      return {
        status: 'failed',
        error_code: 'EXECUTION_FAILED',
        message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
      };
    }
  },
};
