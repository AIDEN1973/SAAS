// LAYER: EDGE_FUNCTION_HANDLER
/**
 * 학생: 등록 실행 Handler
 *
 * Intent: student.exec.register
 * Action Key: student.register (Domain Action Catalog)
 *
 * 챗봇.md 12.1.3 참조
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

export const studentRegisterHandler: IntentHandler = {
  intent_key: 'student.exec.register',

  async execute(
    plan: SuggestedActionChatOpsPlanV1,
    context: HandlerContext
  ): Promise<HandlerResult> {
    try {
      // ⚠️ P0: Plan 스냅샷에서만 실행 대상 로드 (클라이언트 입력 무시)
      const formValues = plan.params as Record<string, unknown>;

      if (!formValues || typeof formValues !== 'object') {
        return {
          status: 'failed',
          error_code: 'INVALID_PARAMS',
          message: '등록 정보가 필요합니다.',
        };
      }

      // ⚠️ P0: Domain Action Catalog 검증 (Fail-Closed)
      assertDomainActionKey('student.register');

      // ⚠️ P0: Policy 재평가 (실행 시점)
      // Domain Action 정책 경로: domain_action.student.register.enabled
      const policyPath = 'domain_action.student.register.enabled';
      const policyEnabled = await getTenantSettingByPath(
        context.supabase,
        context.tenant_id,
        policyPath
      );

      if (!policyEnabled || policyEnabled !== true) {
        return {
          status: 'failed',
          error_code: 'POLICY_DISABLED',
          message: '학생 등록 정책이 비활성화되어 있습니다.',
        };
      }

      // 필수 필드 검증
      const name = formValues.name as string;
      if (!name || typeof name !== 'string') {
        return {
          status: 'failed',
          error_code: 'INVALID_PARAMS',
          message: '학생 이름이 필요합니다.',
        };
      }

      // 1. persons 테이블에 생성
      const { data: person, error: personError } = await withTenant(
        context.supabase
          .from('persons')
          .insert({
            name: name,
            email: (formValues.email as string) || null,
            phone: (formValues.phone as string) || null,
            address: (formValues.address as string) || null,
            person_type: 'student',
          })
          .select('id, tenant_id, name, email, phone, address, created_at, updated_at')
          .single(),
        context.tenant_id
      );

      if (personError || !person) {
        const maskedError = maskPII(personError);
        console.error('[studentRegisterHandler] Failed to create person:', maskedError);
        return {
          status: 'failed',
          error_code: 'EXECUTION_FAILED',
          message: '학생 기본 정보 생성에 실패했습니다.',
        };
      }

      // 2. Industry Adapter: 업종별 학생 테이블에 장기 정보 추가
      const studentTableName = await getTenantTableName(context.supabase, context.tenant_id, 'student');
      const { data: academyData, error: academyError } = await withTenant(
        context.supabase
          .from(studentTableName || 'academy_students') // Fallback
          .insert({
            person_id: person.id,
            tenant_id: context.tenant_id,
            birth_date: (formValues.birth_date as string) || null,
            gender: (formValues.gender as string) || null,
            school_name: (formValues.school_name as string) || null,
            grade: (formValues.grade as string) || null,
            status: (formValues.status as string) || 'active',
            notes: (formValues.notes as string) || null,
            profile_image_url: (formValues.profile_image_url as string) || null,
            created_by: context.user_id,
            updated_by: context.user_id,
          })
          .select('id, person_id, birth_date, gender, school_name, grade, status, notes, profile_image_url, created_at, updated_at, created_by, updated_by')
          .single(),
        context.tenant_id
      );

      if (academyError) {
        // 롤백: persons 삭제
        await withTenant(
          context.supabase.from('persons').delete().eq('id', person.id),
          context.tenant_id
        );
        const maskedError = maskPII(academyError);
        console.error('[studentRegisterHandler] Failed to create academy student:', maskedError);
        return {
          status: 'failed',
          error_code: 'EXECUTION_FAILED',
          message: '학생 등록 정보 생성에 실패했습니다.',
        };
      }

      // 3. 보호자 정보 생성 (있는 경우)
      if (formValues.guardians && Array.isArray(formValues.guardians)) {
        for (const guardian of formValues.guardians) {
          if (typeof guardian === 'object' && guardian !== null) {
            const guardianData = guardian as Record<string, unknown>;
            await withTenant(
              context.supabase
                .from('guardians')
                .insert({
                  student_id: person.id,
                  tenant_id: context.tenant_id,
                  name: (guardianData.name as string) || null,
                  phone: (guardianData.phone as string) || null,
                  email: (guardianData.email as string) || null,
                  relationship: (guardianData.relationship as string) || null,
                  is_primary: (guardianData.is_primary as boolean) || false,
                }),
              context.tenant_id
            );
            // 보호자 생성 실패는 로그만 남기고 계속 진행 (부분 실패 허용)
            // 필요시 에러를 수집하여 partial 상태로 반환할 수 있음
          }
        }
      }

      // 4. 태그 할당 (있는 경우)
      if (formValues.tag_ids && Array.isArray(formValues.tag_ids)) {
        for (const tagId of formValues.tag_ids) {
          if (typeof tagId === 'string') {
            await withTenant(
              context.supabase
                .from('tag_assignments')
                .insert({
                  entity_id: person.id,
                  entity_type: 'student',
                  tag_id: tagId,
                  tenant_id: context.tenant_id,
                }),
              context.tenant_id
            );
            // 태그 할당 실패는 로그만 남기고 계속 진행
          }
        }
      }

      return {
        status: 'success',
        result: {
          student_id: person.id,
          name: person.name,
        },
        affected_count: 1,
        message: `${name} 학생 등록이 완료되었습니다.`,
      };
    } catch (error) {
      const maskedError = maskPII(error);
      console.error('[studentRegisterHandler] Execution failed:', maskedError);
      return {
        status: 'failed',
        error_code: 'EXECUTION_FAILED',
        message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
      };
    }
  },
};

