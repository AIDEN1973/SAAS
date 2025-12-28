// LAYER: EDGE_FUNCTION_HANDLER
/**
 * 메시지/공지: 긴급 공지 Handler
 *
 * Intent: message.exec.emergency_notice
 * Event Type: announcement_urgent
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
import { getTenantTableName } from '../../_shared/industry-adapter.ts';

export const messageEmergencyNoticeHandler: IntentHandler = {
  intent_key: 'message.exec.emergency_notice',

  async execute(
    plan: SuggestedActionChatOpsPlanV1,
    context: HandlerContext
  ): Promise<HandlerResult> {
    try {
      // ⚠️ P0: Plan 스냅샷에서만 실행 대상 로드 (클라이언트 입력 무시)
      const params = plan.params as Record<string, unknown>;
      const audience = params.audience as 'all' | 'class' | 'grade';
      const channel = plan.plan_snapshot.channel || 'sms';
      const text = params.text as string;

      if (!audience || !text) {
        return {
          status: 'failed',
          error_code: 'INVALID_PARAMS',
          message: 'audience와 text가 필요합니다.',
        };
      }

      // ⚠️ P0: Policy 재평가 (실행 시점)
      const eventType = plan.event_type || 'announcement_urgent';

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
        console.error('[messageEmergencyNoticeHandler] Invalid event_type:', maskedError);
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

      // Industry Adapter: 업종별 학생 테이블명 동적 조회
      const studentTableName = await getTenantTableName(context.supabase, context.tenant_id, 'student');

      // 수신 대상 조회 (message-send-bulk와 동일 로직)
      let studentIds: string[] = [];
      if (audience === 'all') {
        const { data: allStudents } = await withTenant(
          context.supabase
            .from(studentTableName || 'academy_students') // Fallback
            .select('person_id')
            .eq('status', 'active'),
          context.tenant_id
        );
        studentIds = (allStudents || []).map((s: any) => s.person_id);
      } else if (audience === 'class' && plan.plan_snapshot.targets?.class_ids) {
        const classIds = plan.plan_snapshot.targets.class_ids;
        const { data: classStudents } = await withTenant(
          context.supabase
            .from('student_classes')
            .select('student_id')
            .in('class_id', classIds),
          context.tenant_id
        );
        studentIds = (classStudents || []).map((sc: any) => sc.student_id);
      } else if (audience === 'grade' && plan.plan_snapshot.targets?.grades) {
        const grades = plan.plan_snapshot.targets.grades;
        const { data: gradeStudents } = await withTenant(
          context.supabase
            .from(studentTableName || 'academy_students') // Fallback
            .select('person_id')
            .in('grade', grades)
            .eq('status', 'active'),
          context.tenant_id
        );
        studentIds = (gradeStudents || []).map((s: any) => s.person_id);
      }

      if (studentIds.length === 0) {
        return {
          status: 'failed',
          error_code: 'TARGET_NOT_FOUND',
          message: '수신 대상을 찾을 수 없습니다.',
        };
      }

      // 보호자 연락처 조회
      const { data: guardians, error: guardiansError } = await withTenant(
        context.supabase
          .from('guardians')
          .select('id, student_id, phone, email, is_primary')
          .in('student_id', studentIds)
          .eq('is_primary', true),
        context.tenant_id
      );

      if (guardiansError) {
        const maskedError = maskPII(guardiansError);
        console.error('[messageEmergencyNoticeHandler] Failed to fetch guardians:', maskedError);
        return {
          status: 'failed',
          error_code: 'QUERY_FAILED',
          message: '보호자 정보 조회에 실패했습니다.',
        };
      }

      // 알림 생성
      const notifications: any[] = [];
      for (const guardian of guardians || []) {
        let recipient = '';
        if (normalizedChannel === 'email' && guardian.email) {
          recipient = guardian.email;
        } else if ((normalizedChannel === 'sms' || normalizedChannel === 'kakao_at') && guardian.phone) {
          recipient = guardian.phone;
        }

        if (recipient) {
          notifications.push({
            tenant_id: context.tenant_id,
            channel: normalizedChannel,
            recipient: recipient,
            template_id: null,
            content: text,
            status: 'pending',
            event_type: eventType,
            execution_context: {
              intent_key: plan.intent_key,
              student_id: guardian.student_id,
              guardian_id: guardian.id,
              event_type: eventType,
              audience: audience,
              emergency: true,
            },
          });
        }
      }

      if (notifications.length === 0) {
        return {
          status: 'failed',
          error_code: 'TARGET_NOT_FOUND',
          message: '발송할 연락처를 찾을 수 없습니다.',
        };
      }

      // 알림 일괄 생성
      const { data: createdNotifications, error: notificationError } = await context.supabase
        .from('notifications')
        .insert(notifications)
        .select('id');

      if (notificationError) {
        const maskedError = maskPII(notificationError);
        console.error('[messageEmergencyNoticeHandler] Failed to create notifications:', maskedError);
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
          audience: audience,
        },
        affected_count: affectedCount,
        message: `${affectedCount}명에게 긴급 공지를 발송했습니다.`,
      };
    } catch (error) {
      const maskedError = maskPII(error);
      console.error('[messageEmergencyNoticeHandler] Execution failed:', maskedError);
      return {
        status: 'failed',
        error_code: 'EXECUTION_FAILED',
        message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
      };
    }
  },
};

