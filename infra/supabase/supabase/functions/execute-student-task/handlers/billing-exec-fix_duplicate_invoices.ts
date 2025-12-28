// LAYER: EDGE_FUNCTION_HANDLER
/**
 * 중복 청구서 수정 Handler
 *
 * Intent: billing.exec.fix_duplicate_invoices
 * Action Key: billing.fix_duplicate_invoices (Domain Action Catalog)
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

export const billing_exec_fix_duplicate_invoicesHandler: IntentHandler = {
  intent_key: 'billing.exec.fix_duplicate_invoices',

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
      assertDomainActionKey('billing.fix_duplicate_invoices');

      // ⚠️ P0: Policy 재평가 (실행 시점)
      // Domain Action 정책 경로: domain_action.billing.fix_duplicate_invoices.enabled
      const policyPath = 'domain_action.billing.fix_duplicate_invoices.enabled';
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
          message: '중복 청구서 수정 정책이 비활성화되어 있습니다.',
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

      const { data: invoices, error: invoiceError } = await withTenant(
        context.supabase
          .from('invoices')
          .select('id, payer_id, period_start')
          .gte('period_start', periodStart)
          .lte('period_start', periodEnd),
        context.tenant_id
      );

      if (invoiceError) {
        const maskedError = maskPII(invoiceError);
        console.error('[billing_exec_fix_duplicate_invoicesHandler] Failed to query invoices:', maskedError);
        return {
          status: 'failed',
          error_code: 'EXECUTION_FAILED',
          message: '청구서 조회에 실패했습니다.',
        };
      }

      if (!invoices || invoices.length === 0) {
        return {
          status: 'success',
          result: {
            month,
            fixed_count: 0,
          },
          affected_count: 0,
          message: '중복 청구서가 없습니다.',
        };
      }

      // 중복 청구서 찾기 (같은 payer_id와 period_start)
      const duplicates = new Map<string, string[]>();
      for (const invoice of invoices) {
        const key = `${invoice.payer_id}_${invoice.period_start}`;
        if (!duplicates.has(key)) {
          duplicates.set(key, []);
        }
        duplicates.get(key)!.push(invoice.id);
      }

      // 중복 청구서 삭제 (첫 번째 것만 남기고 나머지 삭제)
      let fixedCount = 0;
      for (const [key, invoiceIds] of duplicates.entries()) {
        if (invoiceIds.length > 1) {
          // 첫 번째 것만 남기고 나머지 삭제
          for (let i = 1; i < invoiceIds.length; i++) {
            const { error: deleteError } = await withTenant(
              context.supabase
                .from('invoices')
                .delete()
                .eq('id', invoiceIds[i]),
              context.tenant_id
            );

            if (deleteError) {
              const maskedError = maskPII(deleteError);
              console.error('[billing_exec_fix_duplicate_invoicesHandler] Failed to delete duplicate:', maskedError);
            } else {
              fixedCount++;
            }
          }
        }
      }

      return {
        status: 'success',
        result: {
          month,
          fixed_count: fixedCount,
        },
        affected_count: fixedCount,
        message: `${fixedCount}개 중복 청구서가 수정되었습니다.`,
      };
    } catch (error) {
      const maskedError = maskPII(error);
      console.error('[billing_exec_fix_duplicate_invoicesHandler] Execution failed:', maskedError);
      return {
        status: 'failed',
        error_code: 'EXECUTION_FAILED',
        message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
      };
    }
  },
};
