// LAYER: EDGE_FUNCTION_HANDLER
/**
 * 출결: 지각 대상 보호자 알림 발송 Handler
 *
 * Intent: attendance.exec.notify_guardians_late
 * Event Type: absence_first_day
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
import { withTenant } from '../../_shared/withTenant.ts';
import { assertAutomationEventType } from '../../_shared/automation-event-catalog.ts';

export const attendanceNotifyGuardiansLateHandler: IntentHandler = {
  intent_key: 'attendance.exec.notify_guardians_late',

  async execute(
    plan: SuggestedActionChatOpsPlanV1,
    context: HandlerContext
  ): Promise<HandlerResult> {
    try {
      // ⚠️ P0: Plan 스냅샷에서만 실행 대상 로드 (클라이언트 입력 무시)
      const studentIds = plan.plan_snapshot.targets.student_ids;
      const channel = plan.plan_snapshot.channel || 'sms';
      const templateId = plan.plan_snapshot.template_id;

      if (!studentIds || studentIds.length === 0) {
        return {
          status: 'failed',
          error_code: 'TARGET_NOT_FOUND',
          message: '실행 대상이 없습니다.',
        };
      }

      // ⚠️ P0: Policy 재평가 (실행 시점)
      // event_type은 plan.event_type에서 가져옴 (L2-A인 경우)
      const eventType = plan.event_type;
      if (!eventType) {
        return {
          status: 'failed',
          error_code: 'INVALID_PARAMS',
          message: 'event_type이 없습니다.',
        };
      }

      // ⚠️ P0: event_type 검증 (AUTOMATION_EVENT_CATALOG에 존재하는지 확인)
      try {
        assertAutomationEventType(eventType);
      } catch (eventTypeError) {
        // P0: PII 마스킹 필수
        const maskedError = maskPII(eventTypeError);
        console.error('[attendanceNotifyGuardiansLateHandler] Invalid event_type:', maskedError);
        return {
          status: 'failed',
          error_code: 'INVALID_EVENT_TYPE',
          message: `유효하지 않은 event_type입니다: ${eventType}`,
        };
      }

      // Policy 검증 (getTenantSettingByPath 사용, SSOT 헬퍼 함수 사용)
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

      // 채널 Policy 조회 (Fail-Closed, SSOT 헬퍼 함수 사용)
      const channelPolicyPath = getAutomationEventPolicyPath(eventType, 'channel');
      const channelPolicy = await getTenantSettingByPath(
        context.supabase,
        context.tenant_id,
        channelPolicyPath
      );
      const finalChannel = (channelPolicy as string) || channel || 'sms';
      // SSOT-3: 'kakao' 저장 금지, 'kakao_at'로 정규화
      const normalizedChannel = finalChannel === 'kakao' ? 'kakao_at' : finalChannel;

      // 학생별 보호자 연락처 조회
      // guardians 테이블에서 직접 조회 (student_id는 person_id를 참조)
      const { data: guardians, error: guardiansError } = await withTenant(
        context.supabase
          .from('guardians')
          .select('id, student_id, phone, is_primary')
          .in('student_id', studentIds)
          .eq('is_primary', true),
        context.tenant_id
      );

      if (guardiansError) {
        // P0: PII 마스킹 필수
        const maskedError = maskPII(guardiansError);
        console.error('[attendanceNotifyGuardiansLateHandler] Failed to fetch guardians:', maskedError);
        return {
          status: 'failed',
          error_code: 'QUERY_FAILED',
          message: '보호자 정보 조회에 실패했습니다.',
        };
      }

      // 보호자 연락처 수집
      const guardianContacts: Array<{ student_id: string; guardian_id: string; phone: string }> = [];
      for (const guardian of guardians || []) {
        if (guardian.phone) {
          guardianContacts.push({
            student_id: guardian.student_id,
            guardian_id: guardian.id,
            phone: guardian.phone,
          });
        }
      }

      if (guardianContacts.length === 0) {
        return {
          status: 'failed',
          error_code: 'TARGET_NOT_FOUND',
          message: '보호자 연락처를 찾을 수 없습니다.',
        };
      }

      // 알림 발송 (notifications 테이블에 기록)
      const notifications = guardianContacts.map((contact) => ({
        tenant_id: context.tenant_id,
        channel: normalizedChannel,
        recipient: contact.phone,
        template_id: templateId || null,
        content: plan.plan_snapshot.summary || '지각 안내',
        status: 'pending',
        event_type: 'absence_first_day', // notifications 테이블용 event_type
        execution_context: {
          intent_key: plan.intent_key,
          student_id: contact.student_id,
          guardian_id: contact.guardian_id,
          event_type: eventType, // 자동화 정책용 event_type
        },
      }));

      // 알림 일괄 생성
      const { data: createdNotifications, error: notificationError } = await context.supabase
        .from('notifications')
        .insert(notifications)
        .select('id');

      if (notificationError) {
        // P0: PII 마스킹 필수
        const maskedError = maskPII(notificationError);
        console.error('[attendanceNotifyGuardiansLateHandler] Failed to create notifications:', maskedError);
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
          template_id: templateId,
        },
        affected_count: affectedCount,
        message: `${affectedCount}명에게 알림을 발송했습니다.`,
      };
    } catch (error) {
      // ⚠️ P0: PII 마스킹 필수 (체크리스트.md 4. PII 마스킹)
      const maskedError = maskPII(error);
      console.error('[attendanceNotifyGuardiansLateHandler] Execution failed:', maskedError);
      return {
        status: 'failed',
        error_code: 'EXECUTION_FAILED',
        message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
      };
    }
  },
};

