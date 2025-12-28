// LAYER: EDGE_FUNCTION_HANDLER
/**
 * 수납/청구: 1차 연체 안내 발송 Handler
 *
 * Intent: billing.exec.send_overdue_notice_1st
 * Event Type: overdue_outstanding_over_limit
 *
 * 챗봇.md 9-B 참조
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

export const billingSendOverdueNotice1stHandler: IntentHandler = {
  intent_key: 'billing.exec.send_overdue_notice_1st',

  async execute(
    plan: SuggestedActionChatOpsPlanV1,
    context: HandlerContext
  ): Promise<HandlerResult> {
    try {
      // ⚠️ P0: Plan 스냅샷에서만 실행 대상 로드 (클라이언트 입력 무시)
      const studentIds = plan.plan_snapshot.targets?.student_ids || [];
      const month = plan.params.month as string; // YYYY-MM
      const channel = plan.plan_snapshot.channel || 'sms';
      const templateId = plan.plan_snapshot.template_id;

      if (!studentIds || studentIds.length === 0) {
        return {
          status: 'failed',
          error_code: 'TARGET_NOT_FOUND',
          message: '실행 대상이 없습니다.',
        };
      }

      if (!month) {
        return {
          status: 'failed',
          error_code: 'INVALID_PARAMS',
          message: '월 정보가 필요합니다.',
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
        console.error('[billingSendOverdueNotice1stHandler] Invalid event_type:', maskedError);
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
      const finalChannel = (channelPolicy as string) || channel || 'sms';
      const normalizedChannel = finalChannel === 'kakao' ? 'kakao_at' : finalChannel;

      // 학생별 연체 정보 및 보호자 연락처 조회
      const { data: invoices, error: invoicesError } = await withTenant(
        context.supabase
          .from('invoices')
          .select(`
            id,
            student_id,
            amount_due,
            due_date,
            persons!invoices_student_id_fkey(
              id,
              name,
              guardians!guardians_student_id_fkey(
                id,
                phone,
                is_primary
              )
            )
          `)
          .eq('month', month)
          .in('student_id', studentIds)
          .gt('amount_due', 0),
        context.tenant_id
      );

      if (invoicesError) {
        const maskedError = maskPII(invoicesError);
        console.error('[billingSendOverdueNotice1stHandler] Failed to fetch invoices:', maskedError);
        return {
          status: 'failed',
          error_code: 'QUERY_FAILED',
          message: '연체 정보 조회에 실패했습니다.',
        };
      }

      // 보호자별 알림 생성
      const guardianNotifications = new Map<string, any>();
      for (const invoice of invoices || []) {
        const guardians = invoice.persons?.guardians || [];
        const primaryGuardian = guardians.find((g: any) => g.is_primary);

        if (primaryGuardian && primaryGuardian.phone) {
          const key = primaryGuardian.phone;
          if (!guardianNotifications.has(key)) {
            guardianNotifications.set(key, {
              tenant_id: context.tenant_id,
              channel: normalizedChannel,
              recipient: primaryGuardian.phone,
              template_id: templateId || null,
              content: plan.plan_snapshot.summary || `[${month}] 1차 연체 안내`,
              status: 'pending',
              event_type: 'overdue_outstanding_over_limit',
              execution_context: {
                intent_key: plan.intent_key,
                student_id: invoice.student_id,
                invoice_id: invoice.id,
                event_type: eventType,
                month: month,
                notice_type: '1st',
              },
            });
          }
        }
      }

      if (guardianNotifications.size === 0) {
        return {
          status: 'failed',
          error_code: 'TARGET_NOT_FOUND',
          message: '발송할 보호자 연락처를 찾을 수 없습니다.',
        };
      }

      // 알림 일괄 생성
      const notifications = Array.from(guardianNotifications.values());
      const { data: createdNotifications, error: notificationError } = await context.supabase
        .from('notifications')
        .insert(notifications)
        .select('id');

      if (notificationError) {
        const maskedError = maskPII(notificationError);
        console.error('[billingSendOverdueNotice1stHandler] Failed to create notifications:', maskedError);
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
          month: month,
          notice_type: '1st',
        },
        affected_count: affectedCount,
        message: `${affectedCount}명에게 1차 연체 안내를 발송했습니다.`,
      };
    } catch (error) {
      const maskedError = maskPII(error);
      console.error('[billingSendOverdueNotice1stHandler] Execution failed:', maskedError);
      return {
        status: 'failed',
        error_code: 'EXECUTION_FAILED',
        message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
      };
    }
  },
};

