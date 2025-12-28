// LAYER: EDGE_FUNCTION_HANDLER
/**
 * 출결: 직원용 출결 요약 발송 Handler
 *
 * Intent: attendance.exec.send_staff_summary
 * Event Type: announcement_digest
 *
 * 챗봇.md 9-A 참조
 */

import type {
  IntentHandler,
  SuggestedActionChatOpsPlanV1,
  HandlerContext,
  HandlerResult,
} from './types.ts';
import { maskPII } from '../../_shared/pii-utils.ts';
import { getTenantSettingByPath, getAutomationEventPolicyPath } from '../../_shared/policy-utils.ts';
import { assertAutomationEventType } from '../../_shared/automation-event-catalog.ts';

export const attendanceSendStaffSummaryHandler: IntentHandler = {
  intent_key: 'attendance.exec.send_staff_summary',

  async execute(
    plan: SuggestedActionChatOpsPlanV1,
    context: HandlerContext
  ): Promise<HandlerResult> {
    try {
      // ⚠️ P0: Plan 스냅샷에서만 실행 대상 로드
      const recipients = plan.plan_snapshot.targets?.student_ids || []; // recipients는 user_id 배열
      const channel = plan.plan_snapshot.channel || 'email';

      if (!recipients || recipients.length === 0) {
        return {
          status: 'failed',
          error_code: 'TARGET_NOT_FOUND',
          message: '수신 대상이 없습니다.',
        };
      }

      // ⚠️ P0: Policy 재평가 (실행 시점)
      const eventType = plan.event_type;
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
        console.error('[attendanceSendStaffSummaryHandler] Invalid event_type:', maskedError);
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
      if (!policyEnabled || policyEnabled !== true) {
        return {
          status: 'failed',
          error_code: 'POLICY_DISABLED',
          message: '정책이 비활성화되어 있습니다.',
        };
      }

      // 채널 Policy 조회 (SSOT 헬퍼 함수 사용)
      const channelPolicyPath = getAutomationEventPolicyPath(eventType, 'channel');
      const channelPolicy = await getTenantSettingByPath(
        context.supabase,
        context.tenant_id,
        channelPolicyPath
      );
      const finalChannel = (channelPolicy as string) || channel || 'email';
      const normalizedChannel = finalChannel === 'kakao' ? 'kakao_at' : finalChannel;

      // 직원 연락처 조회 (users 테이블 또는 persons 테이블)
      const { data: users, error: usersError } = await context.supabase
        .from('persons')
        .select('id, email, phone')
        .in('id', recipients)
        .eq('person_type', 'staff');

      if (usersError) {
        const maskedError = maskPII(usersError);
        console.error('[attendanceSendStaffSummaryHandler] Failed to fetch users:', maskedError);
        return {
          status: 'failed',
          error_code: 'QUERY_FAILED',
          message: '직원 정보 조회에 실패했습니다.',
        };
      }

      if (!users || users.length === 0) {
        return {
          status: 'failed',
          error_code: 'TARGET_NOT_FOUND',
          message: '직원 연락처를 찾을 수 없습니다.',
        };
      }

      // 알림 발송 (notifications 테이블에 기록)
      const notifications = users.map((user: any) => ({
        tenant_id: context.tenant_id,
        channel: normalizedChannel,
        recipient: normalizedChannel === 'email' ? user.email : user.phone,
        content: plan.plan_snapshot.summary || '출결 요약',
        status: 'pending',
        event_type: 'announcement_digest',
        execution_context: {
          intent_key: plan.intent_key,
          recipient_id: user.id,
          event_type: eventType,
        },
      }));

      // 알림 일괄 생성
      const { data: createdNotifications, error: notificationError } = await context.supabase
        .from('notifications')
        .insert(notifications)
        .select('id');

      if (notificationError) {
        const maskedError = maskPII(notificationError);
        console.error('[attendanceSendStaffSummaryHandler] Failed to create notifications:', maskedError);
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
          message_sent: true,
          channel: normalizedChannel,
        },
        affected_count: affectedCount,
        message: `${affectedCount}명에게 출결 요약을 발송했습니다.`,
      };
    } catch (error) {
      const maskedError = maskPII(error);
      console.error('[attendanceSendStaffSummaryHandler] Execution failed:', maskedError);
      return {
        status: 'failed',
        error_code: 'EXECUTION_FAILED',
        message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
      };
    }
  },
};

