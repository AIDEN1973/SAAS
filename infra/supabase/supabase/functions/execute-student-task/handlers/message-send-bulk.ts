// LAYER: EDGE_FUNCTION_HANDLER
/**
 * 메시지/공지: 일괄 메시지 발송 Handler
 *
 * Intent: message.exec.send_bulk
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
// [불변 규칙] 채널 선택 제거됨 - getAutomationEventPolicyPath는 enabled 정책에만 사용
import { withTenant } from '../../_shared/withTenant.ts';
import { assertAutomationEventType } from '../../_shared/automation-event-catalog.ts';
import { getTenantTableName } from '../../_shared/industry-adapter.ts';
import {
  sendUnifiedMessageBulk,
  getAvailableChannels,
} from '../../_shared/unified-message-sender.ts';

export const messageSendBulkHandler: IntentHandler = {
  intent_key: 'message.exec.send_bulk',

  async execute(
    plan: SuggestedActionChatOpsPlanV1,
    context: HandlerContext
  ): Promise<HandlerResult> {
    try {
      // ⚠️ P0: Plan 스냅샷에서만 실행 대상 로드 (클라이언트 입력 무시)
      // [불변 규칙] 채널 선택 제거됨 - 알림톡 기본, SMS는 폴백으로만 작동
      const params = plan.params as Record<string, unknown>;
      const audience = params.audience as 'all' | 'class' | 'grade';
      const templateId = plan.plan_snapshot.template_id;
      const text = params.text as string | undefined;
      const messagePurpose = params.message_purpose as 'announcement_urgent' | 'announcement_digest' | 'class_change_or_cancel';

      if (!audience || !messagePurpose) {
        return {
          status: 'failed',
          error_code: 'INVALID_PARAMS',
          message: 'audience와 message_purpose가 필요합니다.',
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
        console.error('[messageSendBulkHandler] Invalid event_type:', maskedError);
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

      // [불변 규칙] 채널 선택 제거됨 - 알림톡 기본, SMS는 폴백으로만 작동
      // 더 이상 채널 Policy를 조회하지 않음

      // Industry Adapter: 업종별 학생 테이블명 동적 조회
      const studentTableName = await getTenantTableName(context.supabase, context.tenant_id, 'student');

      // 수신 대상 조회
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

      // 보호자 연락처 조회 (전화번호만 사용 - 알림톡/SMS)
      const { data: guardians, error: guardiansError } = await withTenant(
        context.supabase
          .from('guardians')
          .select('id, student_id, phone, name, is_primary')
          .in('student_id', studentIds)
          .eq('is_primary', true),
        context.tenant_id
      );

      if (guardiansError) {
        const maskedError = maskPII(guardiansError);
        console.error('[messageSendBulkHandler] Failed to fetch guardians:', maskedError);
        return {
          status: 'failed',
          error_code: 'QUERY_FAILED',
          message: '보호자 정보 조회에 실패했습니다.',
        };
      }

      // [불변 규칙] 채널 선택 제거됨 - 알림톡 기본, SMS는 폴백으로만 작동
      // 알림 생성 (전화번호 기반)
      const notifications: any[] = [];
      for (const guardian of guardians || []) {
        if (guardian.phone) {
          notifications.push({
            tenant_id: context.tenant_id,
            recipient: guardian.phone,
            template_id: templateId || null,
            content: text || plan.plan_snapshot.summary || '일괄 메시지',
            status: 'pending',
            event_type: eventType,
            execution_context: {
              intent_key: plan.intent_key,
              student_id: guardian.student_id,
              guardian_id: guardian.id,
              guardian_name: guardian.name,
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

      // [불변 규칙] 통합 메시지 발송: 알림톡 기본, SMS는 폴백으로만 작동
      const channels = getAvailableChannels();
      if (channels.any) {
        const messageContent = text || plan.plan_snapshot.summary || '일괄 메시지';
        const templateCode = plan.plan_snapshot.template_id;

        // [불변 규칙] 채널은 항상 'auto' - 알림톡 우선, SMS 폴백
        const unifiedResult = await sendUnifiedMessageBulk({
          templateCode: templateCode || undefined,
          recipients: notifications.map((n: any) => ({
            receiver: n.recipient,
            recvname: n.execution_context?.guardian_name,
            alimtalkMessage: messageContent, // 알림톡용 메시지
            smsMessage: messageContent, // SMS 폴백용 메시지
          })),
          channel: 'auto', // 항상 알림톡 우선, SMS 폴백
        });

        // 발송 결과 로깅용 알림 레코드 생성
        const notificationsWithStatus = notifications.map((n: any, idx: number) => ({
          ...n,
          status: unifiedResult.success || (unifiedResult.successCount > idx) ? 'sent' : 'failed',
          channel: unifiedResult.usedChannel === 'alimtalk' ? 'kakao_at' : unifiedResult.usedChannel,
          external_msg_id: unifiedResult.alimtalkResult?.mid || unifiedResult.smsResult?.msgId?.toString(),
          sent_at: unifiedResult.success ? new Date().toISOString() : null,
          execution_context: {
            ...n.execution_context,
            provider: unifiedResult.usedChannel === 'alimtalk' ? 'kakao_aligo' : 'aligo_sms',
            used_fallback: unifiedResult.usedFallback,
            test_mode: unifiedResult.testMode,
          },
        }));

        await context.supabase
          .from('notifications')
          .insert(notificationsWithStatus);

        if (!unifiedResult.success && unifiedResult.successCount === 0) {
          return {
            status: 'failed',
            error_code: 'MESSAGE_SEND_FAILED',
            message: unifiedResult.errorMessage || '메시지 발송에 실패했습니다.',
            result: {
              used_channel: unifiedResult.usedChannel,
              used_fallback: unifiedResult.usedFallback,
              test_mode: unifiedResult.testMode,
            },
          };
        }

        // 부분 성공 처리
        if (unifiedResult.errorCount > 0) {
          return {
            status: 'partial',
            result: {
              total_count: unifiedResult.successCount + unifiedResult.errorCount,
              success_count: unifiedResult.successCount,
              error_count: unifiedResult.errorCount,
              channel: unifiedResult.usedChannel,
              used_fallback: unifiedResult.usedFallback,
              audience: audience,
              test_mode: unifiedResult.testMode,
            },
            affected_count: unifiedResult.successCount,
            message: `${unifiedResult.usedChannel === 'alimtalk' ? '알림톡' : 'SMS'} ${unifiedResult.successCount}건 성공, ${unifiedResult.errorCount}건 실패 ${unifiedResult.usedFallback ? '(폴백 발송)' : ''} ${unifiedResult.testMode ? '(테스트 모드)' : ''}`,
          };
        }

        const channelName = unifiedResult.usedChannel === 'alimtalk' ? '알림톡' : 'SMS';
        return {
          status: 'success',
          result: {
            message_sent: true,
            channel: unifiedResult.usedChannel,
            used_fallback: unifiedResult.usedFallback,
            audience: audience,
            test_mode: unifiedResult.testMode,
          },
          affected_count: unifiedResult.successCount,
          message: `${unifiedResult.successCount}명에게 ${channelName} 발송 ${unifiedResult.usedFallback ? '(폴백)' : ''} ${unifiedResult.testMode ? '(테스트 모드)' : '완료'}`,
        };
      }

      // 채널이 설정되지 않은 경우 에러 반환
      return {
        status: 'failed',
        error_code: 'NO_CHANNEL_CONFIGURED',
        message: '알림톡 또는 SMS 채널이 설정되지 않았습니다.',
      };
    } catch (error) {
      const maskedError = maskPII(error);
      console.error('[messageSendBulkHandler] Execution failed:', maskedError);
      return {
        status: 'failed',
        error_code: 'EXECUTION_FAILED',
        message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
      };
    }
  },
};

