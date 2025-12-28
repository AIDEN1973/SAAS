// LAYER: EDGE_FUNCTION_HANDLER
/**
 * 출결 일괄 수정 Handler
 *
 * Intent: attendance.exec.bulk_update
 * Action Key: attendance.bulk_update (Domain Action Catalog)
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

export const attendance_exec_bulk_updateHandler: IntentHandler = {
  intent_key: 'attendance.exec.bulk_update',

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
      assertDomainActionKey('attendance.bulk_update');

      // ⚠️ P0: Policy 재평가 (실행 시점)
      // Domain Action 정책 경로: domain_action.attendance.bulk_update.enabled
      const policyPath = 'domain_action.attendance.bulk_update.enabled';
      const policyEnabled = await getTenantSettingByPath(
        context.supabase,
        context.tenant_id,
        policyPath
      );

      if (!policyEnabled || policyEnabled !== true) {
        return {
          status: 'failed',
          error_code: 'POLICY_DISABLED',
          message: '출결 일괄 수정 정책이 비활성화되어 있습니다.',
        };
      }

      const date = params.date as string;
      const updates = params.updates as Array<{ student_id: string; to_status: string }>;

      if (!date || typeof date !== 'string') {
        return {
          status: 'failed',
          error_code: 'INVALID_PARAMS',
          message: '날짜가 필요합니다.',
        };
      }

      if (!updates || !Array.isArray(updates) || updates.length === 0) {
        return {
          status: 'failed',
          error_code: 'INVALID_PARAMS',
          message: '수정할 출결 정보가 필요합니다.',
        };
      }

      // 날짜 범위 설정 (KST 기준)
      const dateFrom = `${date}T00:00:00+09:00`;
      const dateTo = `${date}T23:59:59+09:00`;

      let successCount = 0;
      const errors: string[] = [];

      for (let i = 0; i < updates.length; i++) {
        const update = updates[i];
        if (!update || typeof update !== 'object') continue;

        const studentId = update.student_id as string;
        const toStatus = update.to_status as string;

        if (!studentId || typeof studentId !== 'string') {
          errors.push(`행 ${i + 1}: 학생 ID가 필요합니다.`);
          continue;
        }

        if (!toStatus || typeof toStatus !== 'string') {
          errors.push(`행 ${i + 1}: 변경할 출결 상태가 필요합니다.`);
          continue;
        }

        try {
          // 출결 로그 조회 및 업데이트
          const { data: logs, error: queryError } = await withTenant(
            context.supabase
              .from('attendance_logs')
              .select('id')
              .eq('student_id', studentId)
              .gte('occurred_at', dateFrom)
              .lte('occurred_at', dateTo),
            context.tenant_id
          );

          if (queryError) {
            const maskedError = maskPII(queryError);
            console.error(`[attendance_exec_bulk_updateHandler] Row ${i + 1} failed to query logs:`, maskedError);
            errors.push(`행 ${i + 1}: 출결 기록 조회 실패`);
            continue;
          }

          if (!logs || logs.length === 0) {
            errors.push(`행 ${i + 1}: 해당 날짜의 출결 기록이 없습니다.`);
            continue;
          }

          // 출결 로그 업데이트
          for (const log of logs) {
            const { error: updateError } = await withTenant(
              context.supabase
                .from('attendance_logs')
                .update({ status: toStatus })
                .eq('id', log.id),
              context.tenant_id
            );

            if (updateError) {
              const maskedError = maskPII(updateError);
              console.error(`[attendance_exec_bulk_updateHandler] Row ${i + 1} failed to update log:`, maskedError);
            }
          }

          successCount++;
        } catch (error) {
          const maskedError = maskPII(error);
          console.error(`[attendance_exec_bulk_updateHandler] Row ${i + 1} error:`, maskedError);
          errors.push(`행 ${i + 1}: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
        }
      }

      if (successCount === 0) {
        return {
          status: 'failed',
          error_code: 'EXECUTION_FAILED',
          message: errors.length > 0 ? errors.join(', ') : '출결 일괄 수정에 실패했습니다.',
        };
      }

      return {
        status: errors.length > 0 ? 'partial' : 'success',
        result: {
          date,
          total_count: updates.length,
          success_count: successCount,
          error_count: errors.length,
        },
        affected_count: successCount,
        message: `${successCount}개 출결 기록 수정이 완료되었습니다.${errors.length > 0 ? ` (${errors.length}개 실패)` : ''}`,
      };
    } catch (error) {
      const maskedError = maskPII(error);
      console.error('[attendance_exec_bulk_updateHandler] Execution failed:', maskedError);
      return {
        status: 'failed',
        error_code: 'EXECUTION_FAILED',
        message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
      };
    }
  },
};
