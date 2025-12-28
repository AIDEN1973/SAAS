// LAYER: EDGE_FUNCTION_HANDLER
/**
 * 반 수정 Handler
 *
 * Intent: class.exec.update
 * Action Key: class.update (Domain Action Catalog)
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
import { getTenantTableName } from '../../_shared/industry-adapter.ts';

export const class_exec_updateHandler: IntentHandler = {
  intent_key: 'class.exec.update',

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
      assertDomainActionKey('class.update');

      // ⚠️ P0: Policy 재평가 (실행 시점)
      // Domain Action 정책 경로: domain_action.class.update.enabled
      const policyPath = 'domain_action.class.update.enabled';
      const policyEnabled = await getTenantSettingByPath(
        context.supabase,
        context.tenant_id,
        policyPath
      );

      if (!policyEnabled || policyEnabled !== true) {
        return {
          status: 'failed',
          error_code: 'POLICY_DISABLED',
          message: '반 수정 정책이 비활성화되어 있습니다.',
        };
      }

      const classId = params.class_id as string;
      const patch = params.patch as Record<string, unknown>;

      if (!classId || typeof classId !== 'string') {
        return {
          status: 'failed',
          error_code: 'INVALID_PARAMS',
          message: '반 ID가 필요합니다.',
        };
      }

      if (!patch || typeof patch !== 'object') {
        return {
          status: 'failed',
          error_code: 'INVALID_PARAMS',
          message: '수정할 정보가 필요합니다.',
        };
      }

      const updateData: Record<string, unknown> = {};
      if (patch.name !== undefined) updateData.name = patch.name;
      if (patch.subject !== undefined) updateData.subject = patch.subject;
      if (patch.grade !== undefined) updateData.grade = patch.grade;
      if (patch.capacity !== undefined) updateData.capacity = patch.capacity;
      if (patch.room !== undefined) updateData.room = patch.room;
      if (patch.notes !== undefined) updateData.notes = patch.notes;
      if (patch.status !== undefined) updateData.status = patch.status;
      updateData.updated_by = context.user_id;

      if (Object.keys(updateData).length === 0) {
        return {
          status: 'failed',
          error_code: 'INVALID_PARAMS',
          message: '수정할 정보가 없습니다.',
        };
      }

      // Industry Adapter: 업종별 클래스 테이블명 동적 조회
      const classTableName = await getTenantTableName(context.supabase, context.tenant_id, 'class');

      const { error: updateError } = await withTenant(
        context.supabase
          .from(classTableName || 'academy_classes') // Fallback
          .update(updateData)
          .eq('id', classId),
        context.tenant_id
      );

      if (updateError) {
        const maskedError = maskPII(updateError);
        console.error('[class_exec_updateHandler] Failed to update class:', maskedError);
        return {
          status: 'failed',
          error_code: 'EXECUTION_FAILED',
          message: '반 수정에 실패했습니다.',
        };
      }

      return {
        status: 'success',
        result: {
          class_id: classId,
        },
        affected_count: 1,
        message: '반 수정이 완료되었습니다.',
      };
    } catch (error) {
      const maskedError = maskPII(error);
      console.error('[class_exec_updateHandler] Execution failed:', maskedError);
      return {
        status: 'failed',
        error_code: 'EXECUTION_FAILED',
        message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
      };
    }
  },
};
