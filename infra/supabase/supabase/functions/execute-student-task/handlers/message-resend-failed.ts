// LAYER: EDGE_FUNCTION_HANDLER
/**
 * 메시지/공지: 실패 메시지 재발송 Handler
 *
 * Intent: message.exec.resend_failed
 * Event Type: original_event_type 재사용 (기본값: announcement_urgent)
 *
 * 챗봇.md 9-M 참조
 */

import type {
  IntentHandler,
  SuggestedActionChatOpsPlanV1,
  HandlerContext,
  HandlerResult,
} from './types.ts';
import { maskPII } from '../../_shared/pii-utils.ts';
import { getTenantSettingByPath, getAutomationEventPolicyPath } from '../../_shared/policy-utils.ts';
import { withTenant } from '../../_shared/withTenant.ts';
import { assertAutomationEventType } from '../../_shared/automation-event-catalog.ts';

export const messageResendFailedHandler: IntentHandler = {
  intent_key: 'message.exec.resend_failed',

  async execute(
    plan: SuggestedActionChatOpsPlanV1,
    context: HandlerContext
  ): Promise<HandlerResult> {
    try {
      // ⚠️ P0: Plan 스냅샷에서만 실행 대상 로드 (클라이언트 입력 무시)
      const params = plan.params as Record<string, unknown>;
      const from = params.from as string; // YYYY-MM-DD
      const to = params.to as string; // YYYY-MM-DD
      const originalEventType = params.original_event_type as string;

      if (!from || !to) {
        return {
          status: 'failed',
          error_code: 'INVALID_PARAMS',
          message: 'from과 to 날짜가 필요합니다.',
        };
      }

      // ⚠️ P0: Policy 재평가 (실행 시점)
      // original_event_type을 우선 사용, 없으면 기본값 사용
      let eventType = originalEventType || plan.event_type || 'announcement_urgent';

      if (!eventType) {
        return {
          status: 'failed',
          error_code: 'INVALID_PARAMS',
          message: 'event_type이 없습니다.',
        };
      }

      // ⚠️ P0: event_type 검증
      try {
        assertAutomationEventType(eventType);
      } catch (eventTypeError) {
        const maskedError = maskPII(eventTypeError);
        console.error('[messageResendFailedHandler] Invalid event_type:', maskedError);
        return {
          status: 'failed',
          error_code: 'INVALID_EVENT_TYPE',
          message: `유효하지 않은 event_type입니다: ${eventType}`,
        };
      }

      // Policy 검증 (SSOT 헬퍼 함수 사용)
      const policyEnabledPath = getAutomationEventPolicyPath(eventType, 'enabled');
      const policyEnabled = await getTenantSettingByPath(
        context.supabase,
        context.tenant_id,
        policyEnabledPath
      );
      // 정책이 없으면 기본값으로 true 사용 (마이그레이션 미실행 시 호환성)
      // 정책이 명시적으로 false로 설정된 경우에만 비활성화
      if (policyEnabled === false) {
        return {
          status: 'failed',
          error_code: 'POLICY_DISABLED',
          message: '정책이 비활성화되어 있습니다.',
        };
      }

      // 실패한 알림 조회
      const { data: failedNotifications, error: queryError } = await withTenant(
        context.supabase
          .from('notifications')
          .select('id, recipient, channel, content, template_id, execution_context')
          .eq('status', 'failed')
          .gte('created_at', `${from}T00:00:00+09:00`)
          .lte('created_at', `${to}T23:59:59+09:00`)
          .eq('event_type', originalEventType || eventType),
        context.tenant_id
      );

      if (queryError) {
        const maskedError = maskPII(queryError);
        console.error('[messageResendFailedHandler] Failed to fetch failed notifications:', maskedError);
        return {
          status: 'failed',
          error_code: 'QUERY_FAILED',
          message: '실패한 알림 조회에 실패했습니다.',
        };
      }

      if (!failedNotifications || failedNotifications.length === 0) {
        return {
          status: 'success',
          result: {
            message_resent: false,
            reason: '재발송할 실패 알림이 없습니다.',
          },
          affected_count: 0,
          message: '재발송할 실패 알림이 없습니다.',
        };
      }

      // 재발송 알림 생성
      const resendNotifications = failedNotifications.map((notification: any) => ({
        tenant_id: context.tenant_id,
        channel: notification.channel,
        recipient: notification.recipient,
        template_id: notification.template_id,
        content: notification.content,
        status: 'pending',
        event_type: eventType,
        execution_context: {
          ...notification.execution_context,
          intent_key: plan.intent_key,
          original_notification_id: notification.id,
          event_type: eventType,
          resend: true,
        },
      }));

      // 재발송 알림 일괄 생성
      const { data: createdNotifications, error: notificationError } = await context.supabase
        .from('notifications')
        .insert(resendNotifications)
        .select('id');

      if (notificationError) {
        const maskedError = maskPII(notificationError);
        console.error('[messageResendFailedHandler] Failed to create notifications:', maskedError);
        return {
          status: 'failed',
          error_code: 'NOTIFICATION_CREATION_FAILED',
          message: '알림 생성에 실패했습니다.',
        };
      }

      const affectedCount = createdNotifications?.length || 0;

      return {
        status: 'success',
        result: {
          message_resent: true,
          event_type: eventType,
        },
        affected_count: affectedCount,
        message: `${affectedCount}건의 실패 메시지를 재발송했습니다.`,
      };
    } catch (error) {
      const maskedError = maskPII(error);
      console.error('[messageResendFailedHandler] Execution failed:', maskedError);
      return {
        status: 'failed',
        error_code: 'EXECUTION_FAILED',
        message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
      };
    }
  },
};

