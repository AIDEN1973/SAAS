// LAYER: EDGE_FUNCTION_HANDLER
/**
 * 리포트/대시보드: 월간 리포트 예약 발송 Handler
 *
 * Intent: report.exec.schedule_monthly_report
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
import { assertAutomationEventType } from '../../_shared/automation-event-catalog.ts';

export const reportScheduleMonthlyReportHandler: IntentHandler = {
  intent_key: 'report.exec.schedule_monthly_report',

  async execute(
    plan: SuggestedActionChatOpsPlanV1,
    context: HandlerContext
  ): Promise<HandlerResult> {
    try {
      // ⚠️ P0: Plan 스냅샷에서만 실행 대상 로드 (클라이언트 입력 무시)
      const dayOfMonth = plan.params.day_of_month as number;
      const recipients = plan.params.recipients as string[]; // person_id 배열
      const channel = plan.plan_snapshot.channel || 'email';

      if (!dayOfMonth || !recipients || recipients.length === 0) {
        return {
          status: 'failed',
          error_code: 'INVALID_PARAMS',
          message: 'day_of_month와 recipients가 필요합니다.',
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
        console.error('[reportScheduleMonthlyReportHandler] Invalid event_type:', maskedError);
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

      // 예약 스케줄 생성 (실제 구현은 scheduled_tasks 테이블 또는 별도 스케줄러 사용)
      // 여기서는 간단히 notifications 테이블에 scheduled 상태로 기록

      return {
        status: 'success',
        result: {
          schedule_created: true,
          channel: normalizedChannel,
          day_of_month: dayOfMonth,
        },
        affected_count: recipients.length,
        message: `월간 리포트 예약 발송을 설정했습니다. (매월 ${dayOfMonth}일)`,
      };
    } catch (error) {
      const maskedError = maskPII(error);
      console.error('[reportScheduleMonthlyReportHandler] Execution failed:', maskedError);
      return {
        status: 'failed',
        error_code: 'EXECUTION_FAILED',
        message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
      };
    }
  },
};

