// LAYER: EDGE_FUNCTION_HANDLER
/**
 * 수업 세션 추가 Handler
 *
 * Intent: schedule.exec.add_session
 * Action Key: schedule.add_session (Domain Action Catalog)
 *
 * 챗봇.md 12.1.3 참조
 *
 */

import type {
  IntentHandler,
  SuggestedActionChatOpsPlanV1,
  HandlerContext,
  HandlerResult,
} from './types.ts';
import { maskPII } from '../../_shared/pii-utils.ts';
import { getTenantSettingByPath } from '../../_shared/policy-utils.ts';
import { withTenant } from '../../_shared/withTenant.ts';
import { assertDomainActionKey } from '../../_shared/domain-action-catalog.ts';

export const schedule_exec_add_sessionHandler: IntentHandler = {
  intent_key: 'schedule.exec.add_session',

  async execute(
    plan: SuggestedActionChatOpsPlanV1,
    context: HandlerContext
  ): Promise<HandlerResult> {
    try {
      // ⚠️ P0: Plan 스냅샷에서만 실행 대상 로드 (클라이언트 입력 무시)
      const params = plan.params as Record<string, unknown>;

      if (!params || typeof params !== 'object') {
        return {
          status: 'failed',
          error_code: 'INVALID_PARAMS',
          message: '파라미터가 필요합니다.',
        };
      }

      // ⚠️ P0: Domain Action Catalog 검증 (Fail-Closed)
      assertDomainActionKey('schedule.add_session');

      // ⚠️ P0: Policy 재평가 (실행 시점)
      // Domain Action 정책 경로: domain_action.schedule.add_session.enabled
      const policyPath = 'domain_action.schedule.add_session.enabled';
      const policyEnabled = await getTenantSettingByPath(
        context.supabase,
        context.tenant_id,
        policyPath
      );

      // 정책이 없으면 기본값으로 true 사용 (마이그레이션 미실행 시 호환성)
      // 정책이 명시적으로 false로 설정된 경우에만 비활성화
      if (policyEnabled === false) {
        return {
          status: 'failed',
          error_code: 'POLICY_DISABLED',
          message: '수업 세션 추가 정책이 비활성화되어 있습니다.',
        };
      }

      const classId = params.class_id as string;
      const startsAt = params.starts_at as string;
      const endsAt = params.ends_at as string;
      const room = params.room as string | undefined;

      if (!classId || typeof classId !== 'string') {
        return {
          status: 'failed',
          error_code: 'INVALID_PARAMS',
          message: '반 ID가 필요합니다.',
        };
      }

      if (!startsAt || typeof startsAt !== 'string') {
        return {
          status: 'failed',
          error_code: 'INVALID_PARAMS',
          message: '시작 시간이 필요합니다.',
        };
      }

      if (!endsAt || typeof endsAt !== 'string') {
        return {
          status: 'failed',
          error_code: 'INVALID_PARAMS',
          message: '종료 시간이 필요합니다.',
        };
      }

      // 수업 세션 생성
      // ⚠️ 중요: INSERT 쿼리는 withTenant를 사용하지 않고, row object에 tenant_id를 직접 포함
      const { data: session, error: createError } = await context.supabase
        .from('class_sessions')
        .insert({
          tenant_id: context.tenant_id,
          class_id: classId,
          starts_at: startsAt,
          ends_at: endsAt,
          room: room || null,
        })
        .select('id')
        .single();

      if (createError) {
        const maskedError = maskPII(createError);
        console.error('[schedule_exec_add_sessionHandler] Failed to create session:', maskedError);
        return {
          status: 'failed',
          error_code: 'EXECUTION_FAILED',
          message: '수업 세션 추가에 실패했습니다.',
        };
      }

      return {
        status: 'success',
        result: {
          session_id: session.id,
          class_id: classId,
          starts_at: startsAt,
          ends_at: endsAt,
        },
        affected_count: 1,
        message: '수업 세션 추가가 완료되었습니다.',
      };
    } catch (error) {
      const maskedError = maskPII(error);
      console.error('[schedule_exec_add_sessionHandler] Execution failed:', maskedError);
      return {
        status: 'failed',
        error_code: 'EXECUTION_FAILED',
        message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
      };
    }
  },
};
