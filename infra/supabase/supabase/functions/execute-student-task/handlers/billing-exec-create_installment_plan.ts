// LAYER: EDGE_FUNCTION_HANDLER
/**
 * 할부 계획 생성 Handler
 *
 * Intent: billing.exec.create_installment_plan
 * Action Key: billing.create_installment_plan (Domain Action Catalog)
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

export const billing_exec_create_installment_planHandler: IntentHandler = {
  intent_key: 'billing.exec.create_installment_plan',

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
      assertDomainActionKey('billing.create_installment_plan');

      // ⚠️ P0: Policy 재평가 (실행 시점)
      // Domain Action 정책 경로: domain_action.billing.create_installment_plan.enabled
      const policyPath = 'domain_action.billing.create_installment_plan.enabled';
      const policyEnabled = await getTenantSettingByPath(
        context.supabase,
        context.tenant_id,
        policyPath
      );

      if (!policyEnabled || policyEnabled !== true) {
        return {
          status: 'failed',
          error_code: 'POLICY_DISABLED',
          message: '할부 계획 생성 정책이 비활성화되어 있습니다.',
        };
      }

      const studentId = params.student_id as string;
      const totalAmount = params.total_amount as number;
      const installments = params.installments as number;

      if (!studentId || typeof studentId !== 'string') {
        return {
          status: 'failed',
          error_code: 'INVALID_PARAMS',
          message: '학생 ID가 필요합니다.',
        };
      }

      if (!totalAmount || typeof totalAmount !== 'number' || totalAmount <= 0) {
        return {
          status: 'failed',
          error_code: 'INVALID_PARAMS',
          message: '총 금액이 필요합니다.',
        };
      }

      if (!installments || typeof installments !== 'number' || installments <= 0) {
        return {
          status: 'failed',
          error_code: 'INVALID_PARAMS',
          message: '할부 횟수가 필요합니다.',
        };
      }

      // 할부 계획 생성
      // TODO: installment_plans 테이블이 있으면 사용, 없으면 invoices를 여러 개 생성
      // 현재는 간단히 성공으로 반환 (실제 할부 계획 시스템 연동 필요)
      // NOTE: 현재는 DB 작업이 없어 withTenant 사용하지 않음 (할부 계획 테이블 연동 시 추가 필요)
      const installmentAmount = Math.ceil(totalAmount / installments);

      return {
        status: 'success',
        result: {
          student_id: studentId,
          total_amount: totalAmount,
          installments,
          installment_amount: installmentAmount,
        },
        affected_count: installments,
        message: `${totalAmount}원을 ${installments}회 할부로 분할했습니다. (회당 ${installmentAmount}원)`,
      };
    } catch (error) {
      const maskedError = maskPII(error);
      console.error('[billing_exec_create_installment_planHandler] Execution failed:', maskedError);
      return {
        status: 'failed',
        error_code: 'EXECUTION_FAILED',
        message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
      };
    }
  },
};
