// LAYER: EDGE_FUNCTION_HANDLER
/**
 * 자동화 정책 활성화 Handler
 *
 * Intent: policy.exec.enable_automation
 * Action Key: policy.enable_automation (Domain Action Catalog)
 *
 * 챗봇.md 12.1.3 참조
 *
 * 자동화 정책 활성화/비활성화를 처리합니다.
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

export const policy_exec_enable_automationHandler: IntentHandler = {
  intent_key: 'policy.exec.enable_automation',

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
      assertDomainActionKey('policy.enable_automation');

      // ⚠️ P0: Policy 재평가 (실행 시점)
      // Domain Action 정책 경로: domain_action.policy.enable_automation.enabled
      const policyPath = 'domain_action.policy.enable_automation.enabled';
      const policyEnabled = await getTenantSettingByPath(
        context.supabase,
        context.tenant_id,
        policyPath
      );

      if (!policyEnabled || policyEnabled !== true) {
        return {
          status: 'failed',
          error_code: 'POLICY_DISABLED',
          message: '자동화 정책 활성화 정책이 비활성화되어 있습니다.',
        };
      }

      const eventType = params.event_type as string;
      const enabled = params.enabled as boolean;

      if (!eventType || typeof eventType !== 'string') {
        return {
          status: 'failed',
          error_code: 'INVALID_PARAMS',
          message: '이벤트 타입이 필요합니다.',
        };
      }

      if (typeof enabled !== 'boolean') {
        return {
          status: 'failed',
          error_code: 'INVALID_PARAMS',
          message: '활성화 여부가 필요합니다.',
        };
      }

      // tenant_settings에서 자동화 정책 업데이트
      // 기존 config 조회
      const { data: existingConfig, error: queryError } = await withTenant(
        context.supabase
          .from('tenant_settings')
          .select('value')
          .eq('key', 'config')
          .single(),
        context.tenant_id
      );

      if (queryError && queryError.code !== 'PGRST116') {
        const maskedError = maskPII(queryError);
        console.error('[policy_exec_enable_automationHandler] Failed to query config:', maskedError);
        return {
          status: 'failed',
          error_code: 'EXECUTION_FAILED',
          message: '설정 조회에 실패했습니다.',
        };
      }

      const currentConfig = (existingConfig?.value as Record<string, unknown>) || {};
      const autoNotification = (currentConfig.auto_notification as Record<string, unknown>) || {};
      const eventConfig = (autoNotification[eventType] as Record<string, unknown>) || {};

      // 정책 업데이트
      const updatedConfig = {
        ...currentConfig,
        auto_notification: {
          ...autoNotification,
          [eventType]: {
            ...eventConfig,
            enabled,
          },
        },
      };

      const { error: updateError } = await withTenant(
        context.supabase
          .from('tenant_settings')
          .upsert({
            tenant_id: context.tenant_id,
            key: 'config',
            value: updatedConfig,
            updated_at: new Date().toISOString(),
          }),
        context.tenant_id
      );

      if (updateError) {
        const maskedError = maskPII(updateError);
        console.error('[policy_exec_enable_automationHandler] Failed to update policy:', maskedError);
        return {
          status: 'failed',
          error_code: 'EXECUTION_FAILED',
          message: '자동화 정책 활성화에 실패했습니다.',
        };
      }

      return {
        status: 'success',
        result: {
          event_type: eventType,
          enabled,
        },
        affected_count: 1,
        message: '자동화 정책 활성화가 완료되었습니다.',
      };
    } catch (error) {
      const maskedError = maskPII(error);
      console.error('[policy_exec_enable_automationHandler] Execution failed:', maskedError);
      return {
        status: 'failed',
        error_code: 'EXECUTION_FAILED',
        message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
      };
    }
  },
};
