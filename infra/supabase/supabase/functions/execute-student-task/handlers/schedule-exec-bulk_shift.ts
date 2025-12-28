// LAYER: EDGE_FUNCTION_HANDLER
/**
 * 수업 일괄 이동 Handler
 *
 * Intent: schedule.exec.bulk_shift
 * Action Key: schedule.bulk_shift (Domain Action Catalog)
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

export const schedule_exec_bulk_shiftHandler: IntentHandler = {
  intent_key: 'schedule.exec.bulk_shift',

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
      assertDomainActionKey('schedule.bulk_shift');

      // ⚠️ P0: Policy 재평가 (실행 시점)
      // Domain Action 정책 경로: domain_action.schedule.bulk_shift.enabled
      const policyPath = 'domain_action.schedule.bulk_shift.enabled';
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
          message: '수업 일괄 이동 정책이 비활성화되어 있습니다.',
        };
      }

      const classId = params.class_id as string;
      const from = params.from as string;
      const to = params.to as string;
      const shiftMinutes = params.shift_minutes as number;

      if (!classId || typeof classId !== 'string') {
        return {
          status: 'failed',
          error_code: 'INVALID_PARAMS',
          message: '반 ID가 필요합니다.',
        };
      }

      if (!from || typeof from !== 'string') {
        return {
          status: 'failed',
          error_code: 'INVALID_PARAMS',
          message: '시작 날짜가 필요합니다.',
        };
      }

      if (!to || typeof to !== 'string') {
        return {
          status: 'failed',
          error_code: 'INVALID_PARAMS',
          message: '종료 날짜가 필요합니다.',
        };
      }

      if (!shiftMinutes || typeof shiftMinutes !== 'number') {
        return {
          status: 'failed',
          error_code: 'INVALID_PARAMS',
          message: '이동 시간(분)이 필요합니다.',
        };
      }

      // 날짜 범위 설정
      const dateFrom = `${from}T00:00:00+09:00`;
      const dateTo = `${to}T23:59:59+09:00`;

      // 해당 기간의 세션 조회
      const { data: sessions, error: queryError } = await withTenant(
        context.supabase
          .from('class_sessions')
          .select('id, starts_at, ends_at')
          .eq('class_id', classId)
          .gte('starts_at', dateFrom)
          .lte('starts_at', dateTo),
        context.tenant_id
      );

      if (queryError) {
        const maskedError = maskPII(queryError);
        console.error('[schedule_exec_bulk_shiftHandler] Failed to query sessions:', maskedError);
        return {
          status: 'failed',
          error_code: 'EXECUTION_FAILED',
          message: '세션 조회에 실패했습니다.',
        };
      }

      if (!sessions || sessions.length === 0) {
        return {
          status: 'failed',
          error_code: 'NOT_FOUND',
          message: '이동할 세션이 없습니다.',
        };
      }

      // 각 세션 시간 이동
      let updatedCount = 0;
      for (const session of sessions) {
        const startsAt = new Date(session.starts_at);
        const endsAt = new Date(session.ends_at);
        startsAt.setMinutes(startsAt.getMinutes() + shiftMinutes);
        endsAt.setMinutes(endsAt.getMinutes() + shiftMinutes);

        const { error: updateError } = await withTenant(
          context.supabase
            .from('class_sessions')
            .update({
              starts_at: startsAt.toISOString(),
              ends_at: endsAt.toISOString(),
            })
            .eq('id', session.id),
          context.tenant_id
        );

        if (updateError) {
          const maskedError = maskPII(updateError);
          console.error('[schedule_exec_bulk_shiftHandler] Failed to update session:', maskedError);
        } else {
          updatedCount++;
        }
      }

      return {
        status: 'success',
        result: {
          class_id: classId,
          from,
          to,
          shift_minutes: shiftMinutes,
          updated_count: updatedCount,
        },
        affected_count: updatedCount,
        message: `${updatedCount}개 세션 시간 이동이 완료되었습니다.`,
      };
    } catch (error) {
      const maskedError = maskPII(error);
      console.error('[schedule_exec_bulk_shiftHandler] Execution failed:', maskedError);
      return {
        status: 'failed',
        error_code: 'EXECUTION_FAILED',
        message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
      };
    }
  },
};
