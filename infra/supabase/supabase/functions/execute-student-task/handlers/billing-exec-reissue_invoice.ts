// LAYER: EDGE_FUNCTION_HANDLER
/**
 * 청구서 재발행 Handler
 *
 * Intent: billing.exec.reissue_invoice
 * Action Key: billing.reissue_invoice (Domain Action Catalog)
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

export const billing_exec_reissue_invoiceHandler: IntentHandler = {
  intent_key: 'billing.exec.reissue_invoice',

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
      assertDomainActionKey('billing.reissue_invoice');

      // ⚠️ P0: Policy 재평가 (실행 시점)
      // Domain Action 정책 경로: domain_action.billing.reissue_invoice.enabled
      const policyPath = 'domain_action.billing.reissue_invoice.enabled';
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
          message: '청구서 재발행 정책이 비활성화되어 있습니다.',
        };
      }

      const invoiceIds = params.invoice_ids as string[];

      if (!invoiceIds || !Array.isArray(invoiceIds) || invoiceIds.length === 0) {
        return {
          status: 'failed',
          error_code: 'INVALID_PARAMS',
          message: '청구서 ID 목록이 필요합니다.',
        };
      }

      let successCount = 0;
      const errors: string[] = [];

      for (const invoiceId of invoiceIds) {
        if (typeof invoiceId !== 'string') continue;

        try {
          // 청구서 조회
          const { data: invoice, error: queryError } = await withTenant(
            context.supabase
              .from('invoices')
              .select('id, status')
              .eq('id', invoiceId)
              .single(),
            context.tenant_id
          );

          if (queryError || !invoice) {
            const maskedError = maskPII(queryError);
            console.error('[billing_exec_reissue_invoiceHandler] Failed to query invoice:', maskedError);
            errors.push(`청구서 ${invoiceId} 조회 실패`);
            continue;
          }

          // 청구서 상태를 'draft'로 변경하여 재발행 가능하게 함
          const { error: updateError } = await withTenant(
            context.supabase
              .from('invoices')
              .update({ status: 'draft' })
              .eq('id', invoiceId),
            context.tenant_id
          );

          if (updateError) {
            const maskedError = maskPII(updateError);
            console.error('[billing_exec_reissue_invoiceHandler] Failed to update invoice:', maskedError);
            errors.push(`청구서 ${invoiceId} 재발행 실패`);
            continue;
          }

          successCount++;
        } catch (error) {
          const maskedError = maskPII(error);
          console.error('[billing_exec_reissue_invoiceHandler] Error:', maskedError);
          errors.push(`청구서 ${invoiceId}: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
        }
      }

      if (successCount === 0) {
        return {
          status: 'failed',
          error_code: 'EXECUTION_FAILED',
          message: errors.length > 0 ? errors.join(', ') : '청구서 재발행에 실패했습니다.',
        };
      }

      return {
        status: errors.length > 0 ? 'partial' : 'success',
        result: {
          total_count: invoiceIds.length,
          success_count: successCount,
          error_count: errors.length,
        },
        affected_count: successCount,
        message: `${successCount}개 청구서 재발행이 완료되었습니다.${errors.length > 0 ? ` (${errors.length}개 실패)` : ''}`,
      };
    } catch (error) {
      const maskedError = maskPII(error);
      console.error('[billing_exec_reissue_invoiceHandler] Execution failed:', maskedError);
      return {
        status: 'failed',
        error_code: 'EXECUTION_FAILED',
        message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
      };
    }
  },
};
