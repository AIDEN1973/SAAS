// LAYER: EDGE_FUNCTION_HANDLER
/**
 * 검색 인덱스 재구성 Handler
 *
 * Intent: system.exec.rebuild_search_index
 * Action Key: system.rebuild_search_index (Domain Action Catalog)
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

export const system_exec_rebuild_search_indexHandler: IntentHandler = {
  intent_key: 'system.exec.rebuild_search_index',

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
      assertDomainActionKey('system.rebuild_search_index');

      // ⚠️ P0: Policy 재평가 (실행 시점)
      // Domain Action 정책 경로: domain_action.system.rebuild_search_index.enabled
      const policyPath = 'domain_action.system.rebuild_search_index.enabled';
      const policyEnabled = await getTenantSettingByPath(
        context.supabase,
        context.tenant_id,
        policyPath
      );

      if (!policyEnabled || policyEnabled !== true) {
        return {
          status: 'failed',
          error_code: 'POLICY_DISABLED',
          message: '검색 인덱스 재구성 정책이 비활성화되어 있습니다.',
        };
      }

      // 검색 인덱스 재구성
      // TODO: 실제 검색 인덱스 재구성 로직 구현 필요
      // NOTE: 현재는 DB 작업이 없어 withTenant 사용하지 않음 (검색 인덱스 시스템 연동 시 추가 필요)
      return {
        status: 'success',
        result: {
          message: '검색 인덱스 재구성이 시작되었습니다.',
        },
        affected_count: 0,
        message: '검색 인덱스 재구성이 시작되었습니다.',
      };
    } catch (error) {
      const maskedError = maskPII(error);
      console.error('[system_exec_rebuild_search_indexHandler] Execution failed:', maskedError);
      return {
        status: 'failed',
        error_code: 'EXECUTION_FAILED',
        message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
      };
    }
  },
};
