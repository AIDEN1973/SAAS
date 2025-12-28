// LAYER: EDGE_FUNCTION_HANDLER
/**
 * AI: 직원 검토 요청 Handler
 *
 * Intent: ai.exec.request_staff_review
 * Event Type: consultation_summary_ready
 *
 * 챗봇.md 9-N 참조
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

export const aiRequestStaffReviewHandler: IntentHandler = {
  intent_key: 'ai.exec.request_staff_review',

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

      const studentId = params.student_id as string;
      const topic = params.topic as string;
      const recipients = plan.plan_snapshot.targets?.student_ids || []; // recipients는 staff person_id 배열

      if (!studentId || !topic) {
        return {
          status: 'failed',
          error_code: 'INVALID_PARAMS',
          message: 'student_id와 topic이 필요합니다.',
        };
      }

      if (!recipients || recipients.length === 0) {
        return {
          status: 'failed',
          error_code: 'TARGET_NOT_FOUND',
          message: '수신 대상이 없습니다.',
        };
      }

      // ⚠️ P0: Policy 재평가 (실행 시점)
      const eventType = plan.event_type || 'consultation_summary_ready';

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
        console.error('[aiRequestStaffReviewHandler] Invalid event_type:', maskedError);
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

      // 직원 정보 조회
      const { data: staffPersons, error: staffError } = await withTenant(
        context.supabase
          .from('persons')
          .select('id, name, email, phone')
          .in('id', recipients)
          .eq('person_type', 'staff'),
        context.tenant_id
      );

      if (staffError) {
        const maskedError = maskPII(staffError);
        console.error('[aiRequestStaffReviewHandler] Failed to fetch staff persons:', maskedError);
        return {
          status: 'failed',
          error_code: 'QUERY_FAILED',
          message: '직원 정보 조회에 실패했습니다.',
        };
      }

      // 알림 생성 (기본 채널: email)
      const notifications: any[] = [];
      for (const staff of staffPersons || []) {
        const recipient = staff.email || staff.phone;
        if (recipient) {
          notifications.push({
            tenant_id: context.tenant_id,
            channel: staff.email ? 'email' : 'sms',
            recipient: recipient,
            template_id: null,
            content: plan.plan_snapshot.summary || `[${topic}] 검토가 필요합니다.`,
            status: 'pending',
            event_type: eventType,
            execution_context: {
              intent_key: plan.intent_key,
              student_id: studentId,
              recipient_id: staff.id,
              topic: topic,
              event_type: eventType,
            },
          });
        }
      }

      if (notifications.length === 0) {
        return {
          status: 'failed',
          error_code: 'TARGET_NOT_FOUND',
          message: '발송할 직원 연락처를 찾을 수 없습니다.',
        };
      }

      // 알림 일괄 생성
      const { data: createdNotifications, error: notificationError } = await context.supabase
        .from('notifications')
        .insert(notifications)
        .select('id');

      if (notificationError) {
        const maskedError = maskPII(notificationError);
        console.error('[aiRequestStaffReviewHandler] Failed to create notifications:', maskedError);
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
        },
        affected_count: affectedCount,
        message: `${affectedCount}명에게 직원 검토 요청을 발송했습니다.`,
      };
    } catch (error) {
      const maskedError = maskPII(error);
      console.error('[aiRequestStaffReviewHandler] Execution failed:', maskedError);
      return {
        status: 'failed',
        error_code: 'EXECUTION_FAILED',
        message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
      };
    }
  },
};

