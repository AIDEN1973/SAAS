// LAYER: EDGE_FUNCTION_HANDLER
/**
 * 학생: 신규 등록 환영 메시지 발송 Handler
 *
 * Intent: student.exec.send_welcome_message
 * Event Type: new_member_drop
 *
 * 챗봇.md 9-S 참조
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

export const studentSendWelcomeMessageHandler: IntentHandler = {
  intent_key: 'student.exec.send_welcome_message',

  async execute(
    plan: SuggestedActionChatOpsPlanV1,
    context: HandlerContext
  ): Promise<HandlerResult> {
    try {
      // ⚠️ P0: Plan 스냅샷에서만 실행 대상 로드 (클라이언트 입력 무시)
      const studentId = plan.plan_snapshot.targets?.student_ids?.[0];
      const channel = plan.plan_snapshot.channel || 'sms';
      const templateId = plan.plan_snapshot.template_id;

      if (!studentId) {
        return {
          status: 'failed',
          error_code: 'TARGET_NOT_FOUND',
          message: '학생 ID가 필요합니다.',
        };
      }

      // [P0-FIX] Fail-Closed: event_type 기본값 제거 - 명시적 실패 처리
      const eventType = plan.event_type;

      if (!eventType) {
        return {
          status: 'failed',
          error_code: 'MISSING_EVENT_TYPE',
          message: 'event_type이 반드시 필요합니다. (Fail-Closed 원칙)',
        };
      }

      // ⚠️ P0: event_type 검증
      try {
        assertAutomationEventType(eventType);
      } catch (eventTypeError) {
        const maskedError = maskPII(eventTypeError);
        console.error('[studentSendWelcomeMessageHandler] Invalid event_type:', maskedError);
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

      // 채널 Policy 조회 (SSOT 헬퍼 함수 사용)
      const channelPolicyPath = getAutomationEventPolicyPath(eventType, 'channel');
      const channelPolicy = await getTenantSettingByPath(
        context.supabase,
        context.tenant_id,
        channelPolicyPath
      );
      const finalChannel = (channelPolicy as string) || channel || 'sms';
      const normalizedChannel = finalChannel === 'kakao' ? 'kakao_at' : finalChannel;

      // 보호자 연락처 조회
      const { data: guardian, error: guardianError } = await withTenant(
        context.supabase
          .from('guardians')
          .select('id, phone, email, is_primary')
          .eq('student_id', studentId)
          .eq('is_primary', true)
          .single(),
        context.tenant_id
      );

      if (guardianError || !guardian) {
        const maskedError = maskPII(guardianError);
        console.error('[studentSendWelcomeMessageHandler] Failed to fetch guardian:', maskedError);
        return {
          status: 'failed',
          error_code: 'TARGET_NOT_FOUND',
          message: '보호자 연락처를 찾을 수 없습니다.',
        };
      }

      // 연락처 선택
      let recipient = '';
      if (normalizedChannel === 'email' && guardian.email) {
        recipient = guardian.email;
      } else if ((normalizedChannel === 'sms' || normalizedChannel === 'kakao_at') && guardian.phone) {
        recipient = guardian.phone;
      }

      if (!recipient) {
        return {
          status: 'failed',
          error_code: 'TARGET_NOT_FOUND',
          message: '해당 채널의 보호자 연락처를 찾을 수 없습니다.',
        };
      }

      // 알림 발송
      const notification = {
        tenant_id: context.tenant_id,
        channel: normalizedChannel,
        recipient: recipient,
        template_id: templateId || null,
        content: plan.plan_snapshot.summary || '환영합니다!',
        status: 'pending',
        event_type: eventType,
        execution_context: {
          intent_key: plan.intent_key,
          student_id: studentId,
          guardian_id: guardian.id,
          event_type: eventType,
        },
      };

      const { data: createdNotification, error: notificationError } = await context.supabase
        .from('notifications')
        .insert(notification)
        .select('id')
        .single();

      if (notificationError) {
        const maskedError = maskPII(notificationError);
        console.error('[studentSendWelcomeMessageHandler] Failed to create notification:', maskedError);
        return {
          status: 'failed',
          error_code: 'NOTIFICATION_CREATION_FAILED',
          message: '알림 생성에 실패했습니다.',
        };
      }

      return {
        status: 'success',
        result: {
          message_sent: true,
          channel: normalizedChannel,
        },
        affected_count: 1,
        message: '환영 메시지 발송을 완료했습니다.',
      };
    } catch (error) {
      const maskedError = maskPII(error);
      console.error('[studentSendWelcomeMessageHandler] Execution failed:', maskedError);
      return {
        status: 'failed',
        error_code: 'EXECUTION_FAILED',
        message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
      };
    }
  },
};

