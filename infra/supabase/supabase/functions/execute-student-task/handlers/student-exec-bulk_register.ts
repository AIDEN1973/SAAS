// LAYER: EDGE_FUNCTION_HANDLER
/**
 * 학생 일괄 등록 Handler
 *
 * Intent: student.exec.bulk_register
 * Action Key: student.bulk_register (Domain Action Catalog)
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

export const student_exec_bulk_registerHandler: IntentHandler = {
  intent_key: 'student.exec.bulk_register',

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
      assertDomainActionKey('student.bulk_register');

      // ⚠️ P0: Policy 재평가 (실행 시점)
      // Domain Action 정책 경로: domain_action.student.bulk_register.enabled
      const policyPath = 'domain_action.student.bulk_register.enabled';
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
          message: '학생 일괄 등록 정책이 비활성화되어 있습니다.',
        };
      }

      const rows = params.rows as Array<Record<string, unknown>>;

      if (!rows || !Array.isArray(rows) || rows.length === 0) {
        return {
          status: 'failed',
          error_code: 'INVALID_PARAMS',
          message: '등록할 학생 정보가 필요합니다.',
        };
      }

      let successCount = 0;
      const errors: string[] = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!row || typeof row !== 'object') continue;

        try {
          const name = row.name as string;
          if (!name || typeof name !== 'string') {
            errors.push(`행 ${i + 1}: 이름이 필요합니다.`);
            continue;
          }

          // persons 테이블에 생성
          // ⚠️ 중요: INSERT 쿼리는 withTenant를 사용하지 않고, row object에 tenant_id를 직접 포함
          const { data: person, error: personError } = await context.supabase
            .from('persons')
            .insert({
              tenant_id: context.tenant_id,
              name: name,
              email: (row.email as string) || null,
              phone: (row.phone as string) || null,
              address: (row.address as string) || null,
              person_type: 'student',
            })
            .select('id')
            .single();

          if (personError || !person) {
            const maskedError = maskPII(personError);
            console.error(`[student_exec_bulk_registerHandler] Row ${i + 1} failed to create person:`, maskedError);
            errors.push(`행 ${i + 1}: 기본 정보 생성 실패`);
            continue;
          }

          // Industry Adapter: 업종별 학생 테이블명 동적 조회
          const studentTableName = await getTenantTableName(context.supabase, context.tenant_id, 'student');

          // academy_students 테이블에 장기 정보 추가
          // ⚠️ 중요: INSERT 쿼리는 withTenant를 사용하지 않고, row object에 tenant_id를 직접 포함
          // ⚠️ 중요: academy_students 테이블은 이제 id 컬럼이 PRIMARY KEY이고 person_id는 UNIQUE 제약조건
          //          PostgREST가 자동으로 id 컬럼을 RETURNING 할 수 있으므로 일반 INSERT 사용 가능
          const { data: academyData, error: academyError } = await context.supabase
            .from(studentTableName || 'academy_students') // Fallback
            .insert({
              person_id: person.id,
              tenant_id: context.tenant_id,
              birth_date: (row.birth_date as string) || null,
              gender: (row.gender as string) || null,
              school_name: (row.school_name as string) || null,
              grade: (row.grade as string) || null,
              status: (row.status as string) || 'active',
              notes: (row.notes as string) || null,
              created_by: context.user_id,
              updated_by: context.user_id,
            })
            .select('id, person_id')
            .single();

          if (academyError || !academyData) {
            // 롤백: persons 삭제
            await withTenant(
              context.supabase.from('persons').delete().eq('id', person.id),
              context.tenant_id
            );
            const maskedError = maskPII(academyError);
            console.error(`[student_exec_bulk_registerHandler] Row ${i + 1} failed to create academy student:`, maskedError);
            errors.push(`행 ${i + 1}: 등록 정보 생성 실패`);
            continue;
          }

          successCount++;
        } catch (error) {
          const maskedError = maskPII(error);
          console.error(`[student_exec_bulk_registerHandler] Row ${i + 1} error:`, maskedError);
          errors.push(`행 ${i + 1}: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
        }
      }

      if (successCount === 0) {
        return {
          status: 'failed',
          error_code: 'EXECUTION_FAILED',
          message: errors.length > 0 ? errors.join(', ') : '학생 일괄 등록에 실패했습니다.',
        };
      }

      return {
        status: errors.length > 0 ? 'partial' : 'success',
        result: {
          total_count: rows.length,
          success_count: successCount,
          error_count: errors.length,
        },
        affected_count: successCount,
        message: `${successCount}개 학생 등록이 완료되었습니다.${errors.length > 0 ? ` (${errors.length}개 실패)` : ''}`,
      };
    } catch (error) {
      const maskedError = maskPII(error);
      console.error('[student_exec_bulk_registerHandler] Execution failed:', maskedError);
      return {
        status: 'failed',
        error_code: 'EXECUTION_FAILED',
        message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
      };
    }
  },
};
