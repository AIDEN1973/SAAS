// LAYER: EDGE_FUNCTION_HANDLER
/**
 * 출결 기록 수정 Handler
 *
 * Intent: attendance.exec.correct_record
 * Action Key: attendance.correct_record (Domain Action Catalog)
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

export const attendance_exec_correct_recordHandler: IntentHandler = {
  intent_key: 'attendance.exec.correct_record',

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
      assertDomainActionKey('attendance.correct_record');

      // ⚠️ P0: Policy 재평가 (실행 시점)
      // Domain Action 정책 경로: domain_action.attendance.correct_record.enabled
      const policyPath = 'domain_action.attendance.correct_record.enabled';
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
          message: '출결 기록 수정 정책이 비활성화되어 있습니다.',
        };
      }

      const studentId = params.student_id as string;
      const date = params.date as string;
      const fromStatus = params.from_status as string;
      const toStatus = params.to_status as string;
      const reason = params.reason as string | undefined;

      if (!studentId || typeof studentId !== 'string') {
        return {
          status: 'failed',
          error_code: 'INVALID_PARAMS',
          message: '학생 ID가 필요합니다.',
        };
      }

      if (!date || typeof date !== 'string') {
        return {
          status: 'failed',
          error_code: 'INVALID_PARAMS',
          message: '날짜가 필요합니다.',
        };
      }

      if (!toStatus || typeof toStatus !== 'string') {
        return {
          status: 'failed',
          error_code: 'INVALID_PARAMS',
          message: '변경할 출결 상태가 필요합니다.',
        };
      }

      // 날짜 범위 설정 (KST 기준)
      const dateFrom = `${date}T00:00:00+09:00`;
      const dateTo = `${date}T23:59:59+09:00`;

      // 출결 로그 조회 및 업데이트
      let query = withTenant(
        context.supabase
          .from('attendance_logs')
          .select('id, status')
          .eq('student_id', studentId)
          .gte('occurred_at', dateFrom)
          .lte('occurred_at', dateTo),
        context.tenant_id
      );

      // from_status가 지정된 경우 필터링
      if (fromStatus) {
        query = query.eq('status', fromStatus);
      }

      const { data: logs, error: queryError } = await query;

      if (queryError) {
        const maskedError = maskPII(queryError);
        console.error('[attendance_exec_correct_recordHandler] Failed to query attendance logs:', maskedError);
        return {
          status: 'failed',
          error_code: 'EXECUTION_FAILED',
          message: '출결 기록 조회에 실패했습니다.',
        };
      }

      if (!logs || logs.length === 0) {
        return {
          status: 'failed',
          error_code: 'NOT_FOUND',
          message: '해당 날짜의 출결 기록을 찾을 수 없습니다.',
        };
      }

      // 출결 로그 업데이트
      const updateData: Record<string, unknown> = {
        status: toStatus,
      };

      if (reason) {
        updateData.notes = reason;
      }

      let updatedCount = 0;
      for (const log of logs) {
        const { error: updateError } = await withTenant(
          context.supabase
            .from('attendance_logs')
            .update(updateData)
            .eq('id', log.id),
          context.tenant_id
        );

        if (updateError) {
          const maskedError = maskPII(updateError);
          console.error('[attendance_exec_correct_recordHandler] Failed to update attendance log:', maskedError);
        } else {
          updatedCount++;
        }
      }

      if (updatedCount === 0) {
        return {
          status: 'failed',
          error_code: 'EXECUTION_FAILED',
          message: '출결 기록 수정에 실패했습니다.',
        };
      }

      return {
        status: 'success',
        result: {
          student_id: studentId,
          date,
          from_status: fromStatus,
          to_status: toStatus,
          updated_count: updatedCount,
        },
        affected_count: updatedCount,
        message: `${updatedCount}개 출결 기록이 수정되었습니다.`,
      };
    } catch (error) {
      const maskedError = maskPII(error);
      console.error('[attendance_exec_correct_recordHandler] Execution failed:', maskedError);
      return {
        status: 'failed',
        error_code: 'EXECUTION_FAILED',
        message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
      };
    }
  },
};
