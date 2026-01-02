// LAYER: EDGE_FUNCTION_HANDLER
/**
 * 메시지/공지: 일괄 메시지 예약 발송 Handler
 *
 * Intent: message.exec.schedule_bulk
 * Event Type: message_purpose에 따라 결정 (announcement_urgent, announcement_digest, class_change_or_cancel)
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

export const messageScheduleBulkHandler: IntentHandler = {
  intent_key: 'message.exec.schedule_bulk',

  async execute(
    plan: SuggestedActionChatOpsPlanV1,
    context: HandlerContext
  ): Promise<HandlerResult> {
    try {
      // ⚠️ P0: Plan 스냅샷에서만 실행 대상 로드 (클라이언트 입력 무시)
      const params = plan.params as Record<string, unknown>;
      const sendAt = params.send_at as string; // ISO 8601
      const audience = params.audience as 'all' | 'class' | 'grade';
      const channel = plan.plan_snapshot.channel || 'sms';
      const templateId = plan.plan_snapshot.template_id;
      const messagePurpose = params.message_purpose as 'announcement_urgent' | 'announcement_digest' | 'class_change_or_cancel';

      if (!sendAt || !audience || !messagePurpose) {
        return {
          status: 'failed',
          error_code: 'INVALID_PARAMS',
          message: 'send_at, audience, message_purpose가 필요합니다.',
        };
      }

      // [P0-FIX] Fail-Closed: event_type 기본값 제거 - 명시적 실패 처리
      // message_purpose는 필수 파라미터이므로 plan.event_type 우선, 없으면 message_purpose 사용
      const eventType = plan.event_type || messagePurpose;

      if (!eventType) {
        return {
          status: 'failed',
          error_code: 'MISSING_EVENT_TYPE',
          message: 'event_type 또는 message_purpose가 반드시 필요합니다. (Fail-Closed 원칙)',
        };
      }

      // ⚠️ P0: event_type 검증
      try {
        assertAutomationEventType(eventType);
      } catch (eventTypeError) {
        const maskedError = maskPII(eventTypeError);
        console.error('[messageScheduleBulkHandler] Invalid event_type:', maskedError);
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
        console.error('[messageScheduleBulkHandler] Failed to fetch guardians:', maskedError);
        return {
          status: 'failed',
          error_code: 'QUERY_FAILED',
          message: '보호자 정보 조회에 실패했습니다.',
        };
      }

      // 예약 알림 생성
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
            template_id: templateId || null,
            content: plan.plan_snapshot.summary || '예약 메시지',
            status: 'scheduled',
            scheduled_at: sendAt,
            event_type: eventType,
            execution_context: {
              intent_key: plan.intent_key,
              student_id: guardian.student_id,
              guardian_id: guardian.id,
              event_type: eventType,
              message_purpose: messagePurpose,
              audience: audience,
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

      // 예약 알림 일괄 생성
      const { data: createdNotifications, error: notificationError } = await context.supabase
        .from('notifications')
        .insert(notifications)
        .select('id');

      if (notificationError) {
        const maskedError = maskPII(notificationError);
        console.error('[messageScheduleBulkHandler] Failed to create notifications:', maskedError);
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
          message_scheduled: true,
          channel: normalizedChannel,
          audience: audience,
          send_at: sendAt,
        },
        affected_count: affectedCount,
        message: `${affectedCount}명에게 일괄 메시지를 예약했습니다.`,
      };
    } catch (error) {
      const maskedError = maskPII(error);
      console.error('[messageScheduleBulkHandler] Execution failed:', maskedError);
      return {
        status: 'failed',
        error_code: 'EXECUTION_FAILED',
        message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
      };
    }
  },
};

