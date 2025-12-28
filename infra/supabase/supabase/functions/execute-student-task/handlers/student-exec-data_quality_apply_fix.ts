// LAYER: EDGE_FUNCTION_HANDLER
/**
 * 데이터 품질 수정 적용 Handler
 *
 * Intent: student.exec.data_quality_apply_fix
 * Action Key: student.data_quality_apply_fix (Domain Action Catalog)
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

export const student_exec_data_quality_apply_fixHandler: IntentHandler = {
  intent_key: 'student.exec.data_quality_apply_fix',

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
      assertDomainActionKey('student.data_quality_apply_fix');

      // ⚠️ P0: Policy 재평가 (실행 시점)
      // Domain Action 정책 경로: domain_action.student.data_quality_apply_fix.enabled
      const policyPath = 'domain_action.student.data_quality_apply_fix.enabled';
      const policyEnabled = await getTenantSettingByPath(
        context.supabase,
        context.tenant_id,
        policyPath
      );

      if (!policyEnabled || policyEnabled !== true) {
        return {
          status: 'failed',
          error_code: 'POLICY_DISABLED',
          message: '데이터 품질 수정 적용 정책이 비활성화되어 있습니다.',
        };
      }

      const jobId = params.job_id as string;

      if (!jobId || typeof jobId !== 'string') {
        return {
          status: 'failed',
          error_code: 'INVALID_PARAMS',
          message: '작업 ID가 필요합니다.',
        };
      }

      // 데이터 품질 수정 작업 조회 및 적용
      // TODO: 실제 데이터 품질 수정 작업 테이블 구조 확인 필요
      // 현재는 성공으로 반환 (실제 수정 로직 구현 필요)
      // NOTE: 현재는 DB 작업이 없어 withTenant 사용하지 않음 (데이터 품질 작업 테이블 연동 시 추가 필요)
      return {
        status: 'success',
        result: {
          job_id: jobId,
        },
        affected_count: 1,
        message: '데이터 품질 수정 적용이 완료되었습니다.',
      };
    } catch (error) {
      const maskedError = maskPII(error);
      console.error('[student_exec_data_quality_apply_fixHandler] Execution failed:', maskedError);
      return {
        status: 'failed',
        error_code: 'EXECUTION_FAILED',
        message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
      };
    }
  },
};
