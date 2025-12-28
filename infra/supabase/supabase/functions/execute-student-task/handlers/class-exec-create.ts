// LAYER: EDGE_FUNCTION_HANDLER
/**
 * 반 생성 Handler
 *
 * Intent: class.exec.create
 * Action Key: class.create (Domain Action Catalog)
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

export const class_exec_createHandler: IntentHandler = {
  intent_key: 'class.exec.create',

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
      assertDomainActionKey('class.create');

      // ⚠️ P0: Policy 재평가 (실행 시점)
      // Domain Action 정책 경로: domain_action.class.create.enabled
      const policyPath = 'domain_action.class.create.enabled';
      const policyEnabled = await getTenantSettingByPath(
        context.supabase,
        context.tenant_id,
        policyPath
      );

      if (!policyEnabled || policyEnabled !== true) {
        return {
          status: 'failed',
          error_code: 'POLICY_DISABLED',
          message: '반 생성 정책이 비활성화되어 있습니다.',
        };
      }

      const name = params.name as string;
      const teacherId = params.teacher_id as string | undefined;
      const grade = params.grade as string | undefined;
      const capacity = params.capacity as number | undefined;

      if (!name || typeof name !== 'string') {
        return {
          status: 'failed',
          error_code: 'INVALID_PARAMS',
          message: '반 이름이 필요합니다.',
        };
      }

      // Industry Adapter: 업종별 클래스 테이블에 반 생성
      const classTableName = await getTenantTableName(context.supabase, context.tenant_id, 'class');
      const { data: newClass, error: createError } = await withTenant(
        context.supabase
          .from(classTableName || 'academy_classes') // Fallback
          .insert({
            tenant_id: context.tenant_id,
            name,
            grade: grade || null,
            capacity: capacity || 20,
            current_count: 0,
            status: 'active',
            created_by: context.user_id,
            updated_by: context.user_id,
          })
          .select('id')
          .single(),
        context.tenant_id
      );

      if (createError) {
        const maskedError = maskPII(createError);
        console.error('[class_exec_createHandler] Failed to create class:', maskedError);
        return {
          status: 'failed',
          error_code: 'EXECUTION_FAILED',
          message: '반 생성에 실패했습니다.',
        };
      }

      // 강사 배정 (있는 경우)
      if (teacherId) {
        const { error: assignError } = await withTenant(
          context.supabase
            .from('class_teachers')
            .insert({
              tenant_id: context.tenant_id,
              class_id: newClass.id,
              teacher_id: teacherId,
              role: 'teacher',
              is_active: true,
            }),
          context.tenant_id
        );

        if (assignError) {
          const maskedError = maskPII(assignError);
          console.error('[class_exec_createHandler] Failed to assign teacher:', maskedError);
          // 강사 배정 실패는 경고만 남기고 계속 진행
        }
      }

      return {
        status: 'success',
        result: {
          class_id: newClass.id,
          name,
        },
        affected_count: 1,
        message: '반 생성이 완료되었습니다.',
      };
    } catch (error) {
      const maskedError = maskPII(error);
      console.error('[class_exec_createHandler] Execution failed:', maskedError);
      return {
        status: 'failed',
        error_code: 'EXECUTION_FAILED',
        message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
      };
    }
  },
};
