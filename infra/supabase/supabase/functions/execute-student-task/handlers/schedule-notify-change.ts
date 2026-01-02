// LAYER: EDGE_FUNCTION_HANDLER
/**
 * 반/수업/시간표: 시간표 변경 안내 Handler
 *
 * Intent: schedule.exec.notify_change
 * Event Type: class_change_or_cancel
 *
 * 챗봇.md 9-C 참조
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

export const scheduleNotifyChangeHandler: IntentHandler = {
  intent_key: 'schedule.exec.notify_change',

  async execute(
    plan: SuggestedActionChatOpsPlanV1,
    context: HandlerContext
  ): Promise<HandlerResult> {
    try {
      // ⚠️ P0: Plan 스냅샷에서만 실행 대상 로드 (클라이언트 입력 무시)
      const params = plan.params as Record<string, unknown>;
      const classId = params.class_id as string;
      const sessionId = params.session_id as string | undefined;
      const channel = plan.plan_snapshot.channel || 'sms';

      if (!classId) {
        return {
          status: 'failed',
          error_code: 'INVALID_PARAMS',
          message: 'class_id가 필요합니다.',
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
        console.error('[scheduleNotifyChangeHandler] Invalid event_type:', maskedError);
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

      // 반 학생 조회 (message-class-schedule-change-notice와 동일 로직)
      const { data: students, error: studentsError } = await withTenant(
        context.supabase
          .from('student_classes')
          .select(`
            student_id,
            persons!student_classes_student_id_fkey(
              id,
              name,
              guardians!guardians_student_id_fkey(
                id,
                phone,
                email,
                is_primary
              )
            )
          `)
          .eq('class_id', classId),
        context.tenant_id
      );

      if (studentsError) {
        const maskedError = maskPII(studentsError);
        console.error('[scheduleNotifyChangeHandler] Failed to fetch students:', maskedError);
        return {
          status: 'failed',
          error_code: 'QUERY_FAILED',
          message: '학생 정보 조회에 실패했습니다.',
        };
      }

      // 보호자별 알림 생성
      const notifications: any[] = [];
      for (const student of students || []) {
        const guardians = student.persons?.guardians || [];
        const primaryGuardian = guardians.find((g: any) => g.is_primary);

        if (primaryGuardian) {
          let recipient = '';
          if (normalizedChannel === 'email' && primaryGuardian.email) {
            recipient = primaryGuardian.email;
          } else if ((normalizedChannel === 'sms' || normalizedChannel === 'kakao_at') && primaryGuardian.phone) {
            recipient = primaryGuardian.phone;
          }

          if (recipient) {
            notifications.push({
              tenant_id: context.tenant_id,
              channel: normalizedChannel,
              recipient: recipient,
              template_id: plan.plan_snapshot.template_id || null,
              content: plan.plan_snapshot.summary || '시간표가 변경되었습니다.',
              status: 'pending',
              event_type: eventType,
              execution_context: {
                intent_key: plan.intent_key,
                class_id: classId,
                session_id: sessionId,
                student_id: student.student_id,
                guardian_id: primaryGuardian.id,
                event_type: eventType,
              },
            });
          }
        }
      }

      if (notifications.length === 0) {
        return {
          status: 'failed',
          error_code: 'TARGET_NOT_FOUND',
          message: '발송할 보호자 연락처를 찾을 수 없습니다.',
        };
      }

      // 알림 일괄 생성
      const { data: createdNotifications, error: notificationError } = await context.supabase
        .from('notifications')
        .insert(notifications)
        .select('id');

      if (notificationError) {
        const maskedError = maskPII(notificationError);
        console.error('[scheduleNotifyChangeHandler] Failed to create notifications:', maskedError);
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
          class_id: classId,
        },
        affected_count: affectedCount,
        message: `${affectedCount}명에게 시간표 변경 안내를 발송했습니다.`,
      };
    } catch (error) {
      const maskedError = maskPII(error);
      console.error('[scheduleNotifyChangeHandler] Execution failed:', maskedError);
      return {
        status: 'failed',
        error_code: 'EXECUTION_FAILED',
        message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
      };
    }
  },
};

