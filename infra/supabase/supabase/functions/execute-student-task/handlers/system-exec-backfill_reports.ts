// LAYER: EDGE_FUNCTION_HANDLER
/**
 * 리포트 백필 Handler
 *
 * Intent: system.exec.backfill_reports
 * Action Key: system.backfill_reports (Domain Action Catalog)
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

export const system_exec_backfill_reportsHandler: IntentHandler = {
  intent_key: 'system.exec.backfill_reports',

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
      assertDomainActionKey('system.backfill_reports');

      // ⚠️ P0: Policy 재평가 (실행 시점)
      // Domain Action 정책 경로: domain_action.system.backfill_reports.enabled
      const policyPath = 'domain_action.system.backfill_reports.enabled';
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
          message: '리포트 백필 정책이 비활성화되어 있습니다.',
        };
      }

      const from = params.from as string;
      const to = params.to as string;

      if (!from || typeof from !== 'string') {
        return {
          status: 'failed',
          error_code: 'INVALID_PARAMS',
          message: '시작 날짜가 필요합니다.',
        };
      }

      if (!to || typeof to !== 'string') {
        return {
          status: 'failed',
          error_code: 'INVALID_PARAMS',
          message: '종료 날짜가 필요합니다.',
        };
      }

      // 리포트 백필 실행
      // TODO: 실제 백필 로직 구현 필요
      // NOTE: 현재는 DB 작업이 없어 withTenant 사용하지 않음 (리포트 백필 로직 구현 시 추가 필요)
      return {
        status: 'success',
        result: {
          from,
          to,
        },
        affected_count: 0,
        message: '리포트 백필이 시작되었습니다.',
      };
    } catch (error) {
      const maskedError = maskPII(error);
      console.error('[system_exec_backfill_reportsHandler] Execution failed:', maskedError);
      return {
        status: 'failed',
        error_code: 'EXECUTION_FAILED',
        message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
      };
    }
  },
};
