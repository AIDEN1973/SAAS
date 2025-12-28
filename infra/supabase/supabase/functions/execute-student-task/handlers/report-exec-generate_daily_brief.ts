// LAYER: EDGE_FUNCTION_HANDLER
/**
 * 일일 브리프 생성 Handler
 *
 * Intent: report.exec.generate_daily_brief
 * Action Key: report.generate_daily_brief (Domain Action Catalog)
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

export const report_exec_generate_daily_briefHandler: IntentHandler = {
  intent_key: 'report.exec.generate_daily_brief',

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
      assertDomainActionKey('report.generate_daily_brief');

      // ⚠️ P0: Policy 재평가 (실행 시점)
      // Domain Action 정책 경로: domain_action.report.generate_daily_brief.enabled
      const policyPath = 'domain_action.report.generate_daily_brief.enabled';
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
          message: '일일 브리프 생성 정책이 비활성화되어 있습니다.',
        };
      }

      const date = params.date as string;

      if (!date || typeof date !== 'string') {
        return {
          status: 'failed',
          error_code: 'INVALID_PARAMS',
          message: '날짜(YYYY-MM-DD)가 필요합니다.',
        };
      }

      // 일일 브리프 생성 (ai_insights 테이블에 저장)
      // ⚠️ 중요: INSERT 쿼리는 withTenant를 사용하지 않고, row object에 tenant_id를 직접 포함
      // TODO: 실제 브리프 생성 로직 구현 필요
      const { data: brief, error: createError } = await context.supabase
        .from('ai_insights')
        .insert({
          tenant_id: context.tenant_id,
          insight_type: 'daily_briefing',
          title: `${date} 일일 브리프`,
          summary: '일일 브리프 생성 완료',
        })
        .select('id')
        .single();

      if (createError) {
        const maskedError = maskPII(createError);
        console.error('[report_exec_generate_daily_briefHandler] Failed to create brief:', maskedError);
        return {
          status: 'failed',
          error_code: 'EXECUTION_FAILED',
          message: '일일 브리프 생성에 실패했습니다.',
        };
      }

      return {
        status: 'success',
        result: {
          brief_id: brief.id,
          date,
        },
        affected_count: 1,
        message: '일일 브리프 생성이 완료되었습니다.',
      };
    } catch (error) {
      const maskedError = maskPII(error);
      console.error('[report_exec_generate_daily_briefHandler] Execution failed:', maskedError);
      return {
        status: 'failed',
        error_code: 'EXECUTION_FAILED',
        message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
      };
    }
  },
};
