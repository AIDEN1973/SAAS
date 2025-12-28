// LAYER: EDGE_FUNCTION_HANDLER
/**
 * 월간 리포트 생성 Handler
 *
 * Intent: report.exec.generate_monthly_report
 * Action Key: report.generate_monthly_report (Domain Action Catalog)
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

export const report_exec_generate_monthly_reportHandler: IntentHandler = {
  intent_key: 'report.exec.generate_monthly_report',

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
      assertDomainActionKey('report.generate_monthly_report');

      // ⚠️ P0: Policy 재평가 (실행 시점)
      // Domain Action 정책 경로: domain_action.report.generate_monthly_report.enabled
      const policyPath = 'domain_action.report.generate_monthly_report.enabled';
      const policyEnabled = await getTenantSettingByPath(
        context.supabase,
        context.tenant_id,
        policyPath
      );

      if (!policyEnabled || policyEnabled !== true) {
        return {
          status: 'failed',
          error_code: 'POLICY_DISABLED',
          message: '월간 리포트 생성 정책이 비활성화되어 있습니다.',
        };
      }

      const month = params.month as string;
      const sections = params.sections as string[];

      if (!month || typeof month !== 'string') {
        return {
          status: 'failed',
          error_code: 'INVALID_PARAMS',
          message: '월(YYYY-MM)이 필요합니다.',
        };
      }

      // 월간 리포트 생성 (ai_insights 테이블에 저장)
      // TODO: 실제 리포트 생성 로직 구현 필요
      const { data: report, error: createError } = await withTenant(
        context.supabase
          .from('ai_insights')
          .insert({
            tenant_id: context.tenant_id,
            insight_type: 'monthly_report',
            title: `${month} 월간 리포트`,
            summary: `월간 리포트 생성 완료 (섹션: ${sections?.join(', ') || '전체'})`,
          })
          .select('id')
          .single(),
        context.tenant_id
      );

      if (createError) {
        const maskedError = maskPII(createError);
        console.error('[report_exec_generate_monthly_reportHandler] Failed to create report:', maskedError);
        return {
          status: 'failed',
          error_code: 'EXECUTION_FAILED',
          message: '월간 리포트 생성에 실패했습니다.',
        };
      }

      return {
        status: 'success',
        result: {
          report_id: report.id,
          month,
        },
        affected_count: 1,
        message: '월간 리포트 생성이 완료되었습니다.',
      };
    } catch (error) {
      const maskedError = maskPII(error);
      console.error('[report_exec_generate_monthly_reportHandler] Execution failed:', maskedError);
      return {
        status: 'failed',
        error_code: 'EXECUTION_FAILED',
        message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
      };
    }
  },
};
