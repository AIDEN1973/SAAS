// LAYER: EDGE_FUNCTION_HANDLER
/**
 * 정책 임계값 수정 Handler
 *
 * Intent: policy.exec.update_threshold
 * Action Key: policy.update_threshold (Domain Action Catalog)
 *
 * 챗봇.md 12.1.3 참조
 *
 * 정책 임계값을 수정합니다.
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

export const policy_exec_update_thresholdHandler: IntentHandler = {
  intent_key: 'policy.exec.update_threshold',

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
      assertDomainActionKey('policy.update_threshold');

      // ⚠️ P0: Policy 재평가 (실행 시점)
      // Domain Action 정책 경로: domain_action.policy.update_threshold.enabled
      const policyPath = 'domain_action.policy.update_threshold.enabled';
      const policyEnabled = await getTenantSettingByPath(
        context.supabase,
        context.tenant_id,
        policyPath
      );

      if (!policyEnabled || policyEnabled !== true) {
        return {
          status: 'failed',
          error_code: 'POLICY_DISABLED',
          message: '정책 임계값 수정 정책이 비활성화되어 있습니다.',
        };
      }

      const eventType = params.event_type as string;
      const key = params.key as string;
      const value = params.value as string | number | boolean;

      if (!eventType || typeof eventType !== 'string') {
        return {
          status: 'failed',
          error_code: 'INVALID_PARAMS',
          message: '이벤트 타입이 필요합니다.',
        };
      }

      if (!key || typeof key !== 'string') {
        return {
          status: 'failed',
          error_code: 'INVALID_PARAMS',
          message: '임계값 키가 필요합니다.',
        };
      }

      // tenant_settings에서 정책 임계값 업데이트
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
        console.error('[policy_exec_update_thresholdHandler] Failed to query config:', maskedError);
        return {
          status: 'failed',
          error_code: 'EXECUTION_FAILED',
          message: '설정 조회에 실패했습니다.',
        };
      }

      const currentConfig = (existingConfig?.value as Record<string, unknown>) || {};
      const autoNotification = (currentConfig.auto_notification as Record<string, unknown>) || {};
      const eventConfig = (autoNotification[eventType] as Record<string, unknown>) || {};
      const threshold = (eventConfig.threshold as Record<string, unknown>) || {};

      // 임계값 업데이트
      const updatedConfig = {
        ...currentConfig,
        auto_notification: {
          ...autoNotification,
          [eventType]: {
            ...eventConfig,
            threshold: {
              ...threshold,
              [key]: value,
            },
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
        console.error('[policy_exec_update_thresholdHandler] Failed to update threshold:', maskedError);
        return {
          status: 'failed',
          error_code: 'EXECUTION_FAILED',
          message: '정책 임계값 수정에 실패했습니다.',
        };
      }

      return {
        status: 'success',
        result: {
          event_type: eventType,
          key,
          value,
        },
        affected_count: 1,
        message: '정책 임계값 수정이 완료되었습니다.',
      };
    } catch (error) {
      const maskedError = maskPII(error);
      console.error('[policy_exec_update_thresholdHandler] Execution failed:', maskedError);
      return {
        status: 'failed',
        error_code: 'EXECUTION_FAILED',
        message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
      };
    }
  },
};
