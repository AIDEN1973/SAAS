// LAYER: EDGE_FUNCTION_HANDLER
/**
 * 메시지/공지: 보호자 메시지 발송 Handler
 *
 * Intent: message.exec.send_to_guardian
 * Event Type: message_purpose에 따라 결정 (absence_first_day, overdue_outstanding_over_limit, announcement_urgent)
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

export const messageSendToGuardianHandler: IntentHandler = {
  intent_key: 'message.exec.send_to_guardian',

  async execute(
    plan: SuggestedActionChatOpsPlanV1,
    context: HandlerContext
  ): Promise<HandlerResult> {
    try {
      // ⚠️ P0: Plan 스냅샷에서만 실행 대상 로드 (클라이언트 입력 무시)
      const params = plan.params as Record<string, unknown>;
      const studentId = plan.plan_snapshot.targets?.student_ids?.[0];
      const channel = plan.plan_snapshot.channel || 'sms';
      const templateId = plan.plan_snapshot.template_id;
      const text = params.text as string | undefined;
      const messagePurpose = params.message_purpose as 'absence' | 'overdue' | 'general' | undefined;

      if (!studentId) {
        return {
          status: 'failed',
          error_code: 'TARGET_NOT_FOUND',
          message: '학생 ID가 필요합니다.',
        };
      }

      // ⚠️ P0: Policy 재평가 (실행 시점)
      // event_type은 message_purpose에 따라 결정
      let eventType = plan.event_type;
      if (!eventType && messagePurpose) {
        const eventTypeMap: Record<string, string> = {
          absence: 'absence_first_day',
          overdue: 'overdue_outstanding_over_limit',
          general: 'announcement_urgent',
        };
        eventType = eventTypeMap[messagePurpose];
      }

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
        console.error('[messageSendToGuardianHandler] Invalid event_type:', maskedError);
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
        console.error('[messageSendToGuardianHandler] Failed to fetch guardian:', maskedError);
        return {
          status: 'failed',
          error_code: 'TARGET_NOT_FOUND',
          message: '보호자 연락처를 찾을 수 없습니다.',
        };
      }

      // 연락처 선택 (채널에 따라)
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

      // ⚠️ Outbox 패턴: message_outbox에 기록 (외부 발송과 DB 트랜잭션 분리)
      // ChatOps_계약_붕괴_방지_체계_분석.md 2.2.4 참조
      // idempotency_key 생성: intent_key + studentId + channel + templateId 조합
      const idempotencyKeyParts = [
        plan.intent_key,
        studentId,
        normalizedChannel,
        templateId || 'no-template',
        context.now_kst.split('T')[0], // 날짜별 중복 방지 (YYYY-MM-DD만 사용)
      ];
      const idempotencyKeyRaw = idempotencyKeyParts.join(':');
      // SHA-256 해시 생성 (Deno 환경)
      const encoder = new TextEncoder();
      const data = encoder.encode(idempotencyKeyRaw);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      const idempotencyKey = `msg:${hashHex.substring(0, 64)}`;

      // message_outbox에 기록
      const outboxRecord = {
        tenant_id: context.tenant_id,
        intent_key: plan.intent_key,
        student_ids: [studentId],
        channel: normalizedChannel,
        template_id: templateId || null,
        params: {
          text: text || plan.plan_snapshot.summary || '메시지',
          event_type: eventType,
          message_purpose: messagePurpose,
          recipient: recipient, // PII이지만 발송에 필요
          guardian_id: guardian.id,
        },
        status: 'pending',
        idempotency_key: idempotencyKey,
        retry_count: 0,
        max_retries: 3,
        success_count: 0,
        failure_count: 0,
        success_list: null,
        failure_list: null,
        error_message: null,
      };

      const { data: createdOutbox, error: outboxError } = await withTenant(
        context.supabase
          .from('message_outbox')
          .insert(outboxRecord)
          .select('id')
          .single(),
        context.tenant_id
      );

      if (outboxError) {
        // 중복 키 오류인 경우 기존 레코드 조회 (멱등성 보장)
        if (outboxError.code === '23505') { // unique_violation
          console.log('[messageSendToGuardianHandler] 중복 발송 요청 감지 (idempotency_key):', {
            idempotency_key: idempotencyKey.substring(0, 20) + '...',
          });
          // 기존 레코드 조회하여 상태 반환
          const { data: existingOutbox } = await withTenant(
            context.supabase
              .from('message_outbox')
              .select('id, status, success_count, failure_count')
              .eq('idempotency_key', idempotencyKey)
              .single(),
            context.tenant_id
          );

          if (existingOutbox) {
            return {
              status: existingOutbox.status === 'sent' ? 'success' : 'failed',
              result: {
                message_sent: existingOutbox.status === 'sent',
                channel: normalizedChannel,
                outbox_id: existingOutbox.id,
                status: existingOutbox.status,
              },
              affected_count: existingOutbox.success_count || 0,
              message: '이미 처리된 발송 요청입니다.',
            };
          }
        }

        const maskedError = maskPII(outboxError);
        console.error('[messageSendToGuardianHandler] Failed to create outbox record:', maskedError);
        return {
          status: 'failed',
          error_code: 'OUTBOX_CREATION_FAILED',
          message: '발송 요청 기록에 실패했습니다.',
        };
      }

      return {
        status: 'success',
        result: {
          message_sent: false, // Outbox 패턴: 실제 발송은 워커가 처리
          channel: normalizedChannel,
          outbox_id: createdOutbox?.id,
          status: 'pending', // 워커가 처리할 때까지 pending
        },
        affected_count: 1,
        message: '보호자 메시지 발송 요청이 기록되었습니다. (Outbox 패턴)',
      };
    } catch (error) {
      const maskedError = maskPII(error);
      console.error('[messageSendToGuardianHandler] Execution failed:', maskedError);
      return {
        status: 'failed',
        error_code: 'EXECUTION_FAILED',
        message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
      };
    }
  },
};

