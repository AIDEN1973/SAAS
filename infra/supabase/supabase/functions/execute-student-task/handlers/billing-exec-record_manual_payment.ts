// LAYER: EDGE_FUNCTION_HANDLER
/**
 * 수동 결제 기록 Handler
 *
 * Intent: billing.exec.record_manual_payment
 * Action Key: billing.record_manual_payment (Domain Action Catalog)
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

export const billing_exec_record_manual_paymentHandler: IntentHandler = {
  intent_key: 'billing.exec.record_manual_payment',

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
      assertDomainActionKey('billing.record_manual_payment');

      // ⚠️ P0: Policy 재평가 (실행 시점)
      // Domain Action 정책 경로: domain_action.billing.record_manual_payment.enabled
      const policyPath = 'domain_action.billing.record_manual_payment.enabled';
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
          message: '수동 결제 기록 정책이 비활성화되어 있습니다.',
        };
      }

      const studentId = params.student_id as string;
      const amount = params.amount as number;
      const paidAt = params.paid_at as string;
      const method = params.method as 'cash' | 'transfer' | 'card' | 'other';

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
          message: '결제 금액이 필요합니다.',
        };
      }

      if (!paidAt || typeof paidAt !== 'string') {
        return {
          status: 'failed',
          error_code: 'INVALID_PARAMS',
          message: '결제일시가 필요합니다.',
        };
      }

      if (!method || !['cash', 'transfer', 'card', 'other'].includes(method)) {
        return {
          status: 'failed',
          error_code: 'INVALID_PARAMS',
          message: '결제 방법이 필요합니다.',
        };
      }

      // 미결제 청구서 조회 (가장 오래된 것부터)
      const { data: invoices, error: invoiceError } = await withTenant(
        context.supabase
          .from('invoices')
          .select('id, amount, amount_paid')
          .eq('payer_id', studentId)
          .in('status', ['draft', 'issued', 'overdue'])
          .order('due_date', { ascending: true }),
        context.tenant_id
      );

      if (invoiceError) {
        const maskedError = maskPII(invoiceError);
        console.error('[billing_exec_record_manual_paymentHandler] Failed to query invoices:', maskedError);
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
          message: '결제할 청구서가 없습니다.',
        };
      }

      // 결제 기록 생성
      // TODO: payments 테이블이 있으면 사용, 없으면 invoices.amount_paid 업데이트
      let remainingAmount = amount;
      let paidCount = 0;

      for (const invoice of invoices) {
        if (remainingAmount <= 0) break;

        const outstanding = (invoice.amount as number) - ((invoice.amount_paid as number) || 0);
        if (outstanding <= 0) continue;

        const paymentAmount = Math.min(remainingAmount, outstanding);

        // invoices.amount_paid 업데이트
        const { error: updateError } = await withTenant(
          context.supabase
            .from('invoices')
            .update({
              amount_paid: ((invoice.amount_paid as number) || 0) + paymentAmount,
              status: ((invoice.amount_paid as number) || 0) + paymentAmount >= (invoice.amount as number) ? 'paid' : invoice.status,
            })
            .eq('id', invoice.id),
          context.tenant_id
        );

        if (updateError) {
          const maskedError = maskPII(updateError);
          console.error('[billing_exec_record_manual_paymentHandler] Failed to update invoice:', maskedError);
          continue;
        }

        remainingAmount -= paymentAmount;
        paidCount++;
      }

      return {
        status: 'success',
        result: {
          student_id: studentId,
          amount,
          method,
          paid_at: paidAt,
          invoices_paid: paidCount,
        },
        affected_count: paidCount,
        message: `${amount}원 결제가 기록되었습니다. (${paidCount}개 청구서 처리)`,
      };
    } catch (error) {
      const maskedError = maskPII(error);
      console.error('[billing_exec_record_manual_paymentHandler] Execution failed:', maskedError);
      return {
        status: 'failed',
        error_code: 'EXECUTION_FAILED',
        message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
      };
    }
  },
};
