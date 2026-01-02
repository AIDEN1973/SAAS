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
    // ⚠️ 디버깅: context.tenant_id 값 확인
    console.log('[studentRegisterHandler] Context received:', {
      tenant_id: context.tenant_id,
      tenant_id_type: typeof context.tenant_id,
      tenant_id_is_null: context.tenant_id === null,
      tenant_id_is_undefined: context.tenant_id === undefined,
      user_id: context.user_id,
    });
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

      // 디버깅: 정책 값 로그
      console.log('[studentRegisterHandler] Policy check:', {
        policyPath,
        policyEnabled,
        policyEnabledType: typeof policyEnabled,
        policyEnabledIsFalse: policyEnabled === false,
        policyEnabledIsNull: policyEnabled === null,
        policyEnabledIsUndefined: policyEnabled === undefined,
      });

      // 정책이 없으면 기본값으로 true 사용 (마이그레이션 미실행 시 호환성)
      // 정책이 명시적으로 false로 설정된 경우에만 비활성화
      if (policyEnabled === false) {
        console.warn('[studentRegisterHandler] Policy is explicitly disabled:', policyPath);
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
      // ⚠️ 중요: INSERT 쿼리는 withTenant를 사용하지 않고, row object에 tenant_id를 직접 포함
      // ⚠️ 디버깅: INSERT 전 tenant_id 값 확인
      console.log('[studentRegisterHandler] Before INSERT:', {
        tenant_id: context.tenant_id,
        tenant_id_type: typeof context.tenant_id,
        name: name,
      });

      const { data: person, error: personError } = await context.supabase
        .from('persons')
        .insert({
          tenant_id: context.tenant_id,
          name: name,
          email: (formValues.email as string) || null,
          phone: (formValues.phone as string) || null,
          address: (formValues.address as string) || null,
          person_type: 'student',
        })
        .select('id, tenant_id, name, email, phone, address, created_at, updated_at')
        .single();

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
      // ⚠️ 중요: INSERT 쿼리는 withTenant를 사용하지 않고, row object에 tenant_id를 직접 포함
      // ⚠️ 중요: academy_students 테이블은 이제 id 컬럼이 PRIMARY KEY이고 person_id는 UNIQUE 제약조건
      //          PostgREST가 자동으로 id 컬럼을 RETURNING 할 수 있으므로 일반 INSERT 사용 가능
      const studentTableName = await getTenantTableName(context.supabase, context.tenant_id, 'student');
      // P0-3 수정: Fallback 제거 - 업종별 테이블 조회 실패 시 명시적 에러
      if (!studentTableName) {
        // 롤백: persons 삭제
        await withTenant(
          context.supabase.from('persons').delete().eq('id', person.id),
          context.tenant_id
        );
        return {
          status: 'failed',
          error_code: 'INDUSTRY_TABLE_NOT_FOUND',
          message: '업종별 학생 테이블을 찾을 수 없습니다. 테넌트 설정을 확인해주세요.',
        };
      }
      const { data: academyData, error: academyError } = await context.supabase
        .from(studentTableName)
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
        .select('id, person_id')
        .single();

      if (academyError || !academyData) {
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
      // ⚠️ 중요: INSERT 쿼리는 withTenant를 사용하지 않고, row object에 tenant_id를 직접 포함
      // P1-1 수정: guardians 테이블 NOT NULL 컬럼(name, relationship, phone) 필수 전달
      const guardianErrors: string[] = [];
      if (formValues.guardians && Array.isArray(formValues.guardians)) {
        for (const guardian of formValues.guardians) {
          if (typeof guardian === 'object' && guardian !== null) {
            const guardianData = guardian as Record<string, unknown>;
            // NOT NULL 필드 기본값 설정
            const guardianName = (guardianData.name as string) || `${name} 보호자`;
            const guardianPhone = (guardianData.phone as string) || '';
            const guardianRelationship = (guardianData.relationship as string) || 'parent';

            // phone이 없으면 보호자 생성 스킵 (필수 필드)
            if (!guardianPhone) {
              guardianErrors.push('보호자 전화번호 누락');
              continue;
            }

            const { error: guardianError } = await context.supabase
              .from('guardians')
              .insert({
                student_id: person.id,
                tenant_id: context.tenant_id,
                name: guardianName,
                phone: guardianPhone,
                email: (guardianData.email as string) || null,
                relationship: guardianRelationship,
                is_primary: (guardianData.is_primary as boolean) || false,
              });

            if (guardianError) {
              guardianErrors.push(maskPII(guardianError.message) as string);
              console.warn('[studentRegisterHandler] Guardian creation failed:', maskPII(guardianError));
            }
          }
        }
      }

      // 4. 태그 할당 (있는 경우)
      // ⚠️ 중요: INSERT 쿼리는 withTenant를 사용하지 않고, row object에 tenant_id를 직접 포함
      if (formValues.tag_ids && Array.isArray(formValues.tag_ids)) {
        for (const tagId of formValues.tag_ids) {
          if (typeof tagId === 'string') {
            await context.supabase
              .from('tag_assignments')
              .insert({
                entity_id: person.id,
                entity_type: 'student',
                tag_id: tagId,
                tenant_id: context.tenant_id,
              });
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

