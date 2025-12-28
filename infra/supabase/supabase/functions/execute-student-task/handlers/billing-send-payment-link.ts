// LAYER: EDGE_FUNCTION_HANDLER
/**
 * 수납/청구: 결제 링크 발송 Handler
 *
 * Intent: billing.exec.send_payment_link
 * Event Type: payment_due_reminder
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
import { getTenantTableName } from '../../_shared/industry-adapter.ts';

export const billingSendPaymentLinkHandler: IntentHandler = {
  intent_key: 'billing.exec.send_payment_link',

  async execute(
    plan: SuggestedActionChatOpsPlanV1,
    context: HandlerContext
  ): Promise<HandlerResult> {
    try {
      // ⚠️ P0: Plan 스냅샷에서만 실행 대상 로드 (클라이언트 입력 무시)
      const studentId = plan.plan_snapshot.targets?.student_ids?.[0];
      const month = plan.params.month as string; // YYYY-MM
      const channel = plan.plan_snapshot.channel || 'sms';

      if (!studentId) {
        return {
          status: 'failed',
          error_code: 'TARGET_NOT_FOUND',
          message: '학생 ID가 필요합니다.',
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

      // ⚠️ P0: event_type 검증 (AUTOMATION_EVENT_CATALOG에 존재하는지 확인)
      try {
        assertAutomationEventType(eventType);
      } catch (eventTypeError) {
        const maskedError = maskPII(eventTypeError);
        console.error('[billingSendPaymentLinkHandler] Invalid event_type:', maskedError);
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

      // Industry Adapter: 업종별 학생 테이블명 동적 조회
      const studentTableName = await getTenantTableName(context.supabase, context.tenant_id, 'student');
      const personFKName = studentTableName
        ? `${studentTableName}!${studentTableName}_person_id_fkey`
        : 'academy_students!academy_students_person_id_fkey'; // Fallback

      // 학생 정보 및 청구서 조회
      const { data: student, error: studentError } = await withTenant(
        context.supabase
          .from(studentTableName || 'academy_students') // Fallback
          .select(`
            person_id,
            ${personFKName}(id, name)
          `)
          .eq('person_id', studentId)
          .single(),
        context.tenant_id
      );

      if (studentError || !student) {
        const maskedError = maskPII(studentError);
        console.error('[billingSendPaymentLinkHandler] Failed to fetch student:', maskedError);
        return {
          status: 'failed',
          error_code: 'QUERY_FAILED',
          message: '학생 정보 조회에 실패했습니다.',
        };
      }

      // 해당 월의 청구서 조회
      const { data: invoice, error: invoiceError } = await withTenant(
        context.supabase
          .from('invoices')
          .select('id, amount_due, payment_link')
          .eq('student_id', studentId)
          .eq('month', month)
          .single(),
        context.tenant_id
      );

      if (invoiceError || !invoice) {
        const maskedError = maskPII(invoiceError);
        console.error('[billingSendPaymentLinkHandler] Failed to fetch invoice:', maskedError);
        return {
          status: 'failed',
          error_code: 'QUERY_FAILED',
          message: '청구서 정보 조회에 실패했습니다.',
        };
      }

      // 보호자 연락처 조회
      const { data: guardian, error: guardianError } = await withTenant(
        context.supabase
          .from('guardians')
          .select('id, phone, is_primary')
          .eq('student_id', studentId)
          .eq('is_primary', true)
          .single(),
        context.tenant_id
      );

      if (guardianError || !guardian || !guardian.phone) {
        const maskedError = maskPII(guardianError);
        console.error('[billingSendPaymentLinkHandler] Failed to fetch guardian:', maskedError);
        return {
          status: 'failed',
          error_code: 'TARGET_NOT_FOUND',
          message: '보호자 연락처를 찾을 수 없습니다.',
        };
      }

      // 결제 링크 생성 (없는 경우)
      let paymentLink = invoice.payment_link;
      if (!paymentLink) {
        // 결제 링크 생성 로직 (실제 구현은 payment gateway 연동 필요)
        paymentLink = `https://payment.example.com/pay?invoice_id=${invoice.id}`;

        // invoice 업데이트
        const { error: updateError } = await withTenant(
          context.supabase
            .from('invoices')
            .update({ payment_link: paymentLink })
            .eq('id', invoice.id),
          context.tenant_id
        );

        if (updateError) {
          const maskedError = maskPII(updateError);
          console.error('[billingSendPaymentLinkHandler] Failed to update invoice:', maskedError);
        }
      }

      // 알림 발송 (notifications 테이블에 기록)
      const notification = {
        tenant_id: context.tenant_id,
        channel: normalizedChannel,
        recipient: guardian.phone,
        template_id: plan.plan_snapshot.template_id || null,
        content: plan.plan_snapshot.summary || `[${month}] 결제 링크: ${paymentLink}`,
        status: 'pending',
        event_type: 'payment_due_reminder',
        execution_context: {
          intent_key: plan.intent_key,
          student_id: studentId,
          invoice_id: invoice.id,
          event_type: eventType,
          month: month,
          payment_link: paymentLink,
        },
      };

      const { data: createdNotification, error: notificationError } = await context.supabase
        .from('notifications')
        .insert(notification)
        .select('id')
        .single();

      if (notificationError) {
        const maskedError = maskPII(notificationError);
        console.error('[billingSendPaymentLinkHandler] Failed to create notification:', maskedError);
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
          invoice_id: invoice.id,
          payment_link: paymentLink,
          month: month,
        },
        affected_count: 1,
        message: '결제 링크 발송을 완료했습니다.',
      };
    } catch (error) {
      const maskedError = maskPII(error);
      console.error('[billingSendPaymentLinkHandler] Execution failed:', maskedError);
      return {
        status: 'failed',
        error_code: 'EXECUTION_FAILED',
        message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
      };
    }
  },
};

