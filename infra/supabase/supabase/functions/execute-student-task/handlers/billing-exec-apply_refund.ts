// LAYER: EDGE_FUNCTION_HANDLER
/**
 * 환불 적용 Handler
 *
 * Intent: billing.exec.apply_refund
 * Action Key: billing.apply_refund (Domain Action Catalog)
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

export const billing_exec_apply_refundHandler: IntentHandler = {
  intent_key: 'billing.exec.apply_refund',

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
      assertDomainActionKey('billing.apply_refund');

      // ⚠️ P0: Policy 재평가 (실행 시점)
      // Domain Action 정책 경로: domain_action.billing.apply_refund.enabled
      const policyPath = 'domain_action.billing.apply_refund.enabled';
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
          message: '환불 적용 정책이 비활성화되어 있습니다.',
        };
      }

      const studentId = params.student_id as string;
      const amount = params.amount as number;
      const reason = params.reason as string | undefined;

      if (!studentId || typeof studentId !== 'string') {
        return {
          status: 'failed',
          error_code: 'INVALID_PARAMS',
          message: '학생 ID가 필요합니다.',
        };
      }

      if (!amount || typeof amount !== 'number' || amount <= 0) {
        return {
          status: 'failed',
          error_code: 'INVALID_PARAMS',
          message: '환불 금액이 필요합니다.',
        };
      }

      // 결제된 청구서 조회 (가장 최근 것부터)
      const { data: invoices, error: invoiceError } = await withTenant(
        context.supabase
          .from('invoices')
          .select('id, amount_paid')
          .eq('payer_id', studentId)
          .eq('status', 'paid')
          .gt('amount_paid', 0)
          .order('due_date', { ascending: false }),
        context.tenant_id
      );

      if (invoiceError) {
        const maskedError = maskPII(invoiceError);
        console.error('[billing_exec_apply_refundHandler] Failed to query invoices:', maskedError);
        return {
          status: 'failed',
          error_code: 'EXECUTION_FAILED',
          message: '청구서 조회에 실패했습니다.',
        };
      }

      if (!invoices || invoices.length === 0) {
        return {
          status: 'failed',
          error_code: 'NOT_FOUND',
          message: '환불할 결제 내역이 없습니다.',
        };
      }

      // 환불 적용 (amount_paid 감소)
      let remainingRefund = amount;
      let refundedCount = 0;

      for (const invoice of invoices) {
        if (remainingRefund <= 0) break;

        const paidAmount = invoice.amount_paid as number;
        if (paidAmount <= 0) continue;

        const refundAmount = Math.min(remainingRefund, paidAmount);
        const newAmountPaid = paidAmount - refundAmount;

        const { error: updateError } = await withTenant(
          context.supabase
            .from('invoices')
            .update({
              amount_paid: newAmountPaid,
              status: newAmountPaid === 0 ? 'issued' : 'paid',
              notes: reason ? `환불: ${refundAmount}원 (${reason})` : `환불: ${refundAmount}원`,
            })
            .eq('id', invoice.id),
          context.tenant_id
        );

        if (updateError) {
          const maskedError = maskPII(updateError);
          console.error('[billing_exec_apply_refundHandler] Failed to update invoice:', maskedError);
          continue;
        }

        remainingRefund -= refundAmount;
        refundedCount++;
      }

      return {
        status: 'success',
        result: {
          student_id: studentId,
          refund_amount: amount,
          invoices_refunded: refundedCount,
        },
        affected_count: refundedCount,
        message: `${amount}원 환불이 적용되었습니다. (${refundedCount}개 청구서 처리)`,
      };
    } catch (error) {
      const maskedError = maskPII(error);
      console.error('[billing_exec_apply_refundHandler] Execution failed:', maskedError);
      return {
        status: 'failed',
        error_code: 'EXECUTION_FAILED',
        message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
      };
    }
  },
};
