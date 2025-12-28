// LAYER: EDGE_FUNCTION_HANDLER
/**
 * 리포트/대시보드: 리포트 발송 Handler
 *
 * Intent: report.exec.send_report
 * Event Type: monthly_business_report
 *
 * 챗봇.md 9-R 참조
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

export const reportSendReportHandler: IntentHandler = {
  intent_key: 'report.exec.send_report',

  async execute(
    plan: SuggestedActionChatOpsPlanV1,
    context: HandlerContext
  ): Promise<HandlerResult> {
    try {
      // ⚠️ P0: Plan 스냅샷에서만 실행 대상 로드 (클라이언트 입력 무시)
      const params = plan.params as Record<string, unknown>;
      const reportId = params.report_id as string;
      const recipients = params.recipients as string[]; // person_id 배열
      const channel = plan.plan_snapshot.channel || 'email';

      if (!reportId || !recipients || recipients.length === 0) {
        return {
          status: 'failed',
          error_code: 'INVALID_PARAMS',
          message: 'report_id와 recipients가 필요합니다.',
        };
      }

      // ⚠️ P0: Policy 재평가 (실행 시점)
      const eventType = plan.event_type || 'monthly_business_report';

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
        console.error('[reportSendReportHandler] Invalid event_type:', maskedError);
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
      const finalChannel = (channelPolicy as string) || channel || 'email';
      const normalizedChannel = finalChannel === 'kakao' ? 'kakao_at' : finalChannel;

      // 리포트 정보 조회
      const { data: report, error: reportError } = await withTenant(
        context.supabase
          .from('reports')
          .select('id, title, download_url')
          .eq('id', reportId)
          .single(),
        context.tenant_id
      );

      if (reportError || !report) {
        const maskedError = maskPII(reportError);
        console.error('[reportSendReportHandler] Failed to fetch report:', maskedError);
        return {
          status: 'failed',
          error_code: 'QUERY_FAILED',
          message: '리포트 정보 조회에 실패했습니다.',
        };
      }

      // 수신자 정보 조회
      const { data: persons, error: personsError } = await withTenant(
        context.supabase
          .from('persons')
          .select('id, name, email, phone')
          .in('id', recipients),
        context.tenant_id
      );

      if (personsError) {
        const maskedError = maskPII(personsError);
        console.error('[reportSendReportHandler] Failed to fetch persons:', maskedError);
        return {
          status: 'failed',
          error_code: 'QUERY_FAILED',
          message: '수신자 정보 조회에 실패했습니다.',
        };
      }

      // 알림 생성
      const notifications: any[] = [];
      for (const person of persons || []) {
        let recipient = '';
        if (normalizedChannel === 'email' && person.email) {
          recipient = person.email;
        } else if ((normalizedChannel === 'sms' || normalizedChannel === 'kakao_at') && person.phone) {
          recipient = person.phone;
        }

        if (recipient) {
          notifications.push({
            tenant_id: context.tenant_id,
            channel: normalizedChannel,
            recipient: recipient,
            template_id: null,
            content: plan.plan_snapshot.summary || `[${report.title}] 리포트가 준비되었습니다.`,
            status: 'pending',
            event_type: eventType,
            execution_context: {
              intent_key: plan.intent_key,
              report_id: reportId,
              recipient_id: person.id,
              event_type: eventType,
              download_url: report.download_url,
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
        console.error('[reportSendReportHandler] Failed to create notifications:', maskedError);
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
          report_id: reportId,
        },
        affected_count: affectedCount,
        message: `${affectedCount}명에게 리포트를 발송했습니다.`,
      };
    } catch (error) {
      const maskedError = maskPII(error);
      console.error('[reportSendReportHandler] Execution failed:', maskedError);
      return {
        status: 'failed',
        error_code: 'EXECUTION_FAILED',
        message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
      };
    }
  },
};

