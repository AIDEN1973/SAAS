/**
 * Student List Core
 *
 * [SSOT] 학생 리스트 쿼리의 공유 로직 (필터 ID 해석 + enrichment)
 * [불변 규칙] fetchStudents, useStudentsPaged 양쪽에서 사용하여 필터링 로직 중복 방지
 * [불변 규칙] apiClient(브라우저 PostgREST 클라이언트)만 사용 — 서버 코드 의존성 없음
 *
 * [Phase 4] limit:5000 제거 — 서버 RPC(resolve_student_filter_ids)로 필터 해석 이전
 */

import { apiClient } from '@api-sdk/core';
import type { StudentFilter, StudentClass, Guardian } from '@services/student-service';
import type { Class } from '@services/class-service';

/**
 * 필터 조건들을 서버 RPC로 해석하여 제한된 학생 ID 배열을 반환
 *
 * [Phase 4] DB에서 JOIN + WHERE로 필터를 결합하여 단일 쿼리로 처리.
 * 이전: 4개 테이블 각각 limit:5000으로 전체 로드 후 클라이언트 교집합 계산
 * 이후: resolve_student_filter_ids RPC 단일 호출
 *
 * @returns undefined = 필터 조건 없음 (전체 조회), string[] = 해당 ID만 포함
 */
export async function resolveStudentFilterIds(
  tenantId: string,
  filter: StudentFilter | undefined
): Promise<string[] | undefined> {
  // 필터 조건이 없으면 전체 조회 (undefined 반환)
  const hasTagFilter = filter?.tag_ids && filter.tag_ids.length > 0;
  const hasStatusFilter = !!filter?.status;
  const hasGradeFilter = !!filter?.grade;
  const hasClassFilter = filter?.class_id && filter.class_id.trim() !== '' && filter.class_id !== 'all';

  if (!hasTagFilter && !hasStatusFilter && !hasGradeFilter && !hasClassFilter) {
    return undefined;
  }

  // 서버 RPC로 필터 해석 (단일 쿼리로 모든 조건 결합)
  const response = await apiClient.callRPC<string[]>('resolve_student_filter_ids', {
    p_tenant_id: tenantId,
    p_tag_ids: hasTagFilter ? filter!.tag_ids : null,
    p_status: hasStatusFilter ? filter!.status : null,
    p_grade: hasGradeFilter ? filter!.grade : null,
    p_class_id: hasClassFilter ? filter!.class_id : null,
    p_include_deleted: false,
  });

  if (response.error) {
    throw new Error(response.error.message);
  }

  return response.data || [];
}

/**
 * 학생 ID 배열에 대해 주 보호자명 + 대표반명을 병렬 조회
 *
 * @param studentIds - 현재 페이지/결과의 학생 ID 목록
 * @returns guardiansMap(student_id → name), studentClassMap(student_id → class_name)
 */
export async function enrichStudentsWithRelations(
  studentIds: string[]
): Promise<{
  guardiansMap: Map<string, string>;
  studentClassMap: Map<string, string>;
}> {
  const guardiansMap = new Map<string, string>();
  const studentClassMap = new Map<string, string>();

  if (studentIds.length === 0) {
    return { guardiansMap, studentClassMap };
  }

  const [guardiansResponse, studentClassesResponse] = await Promise.all([
    apiClient.get<Guardian>('guardians', {
      filters: { student_id: studentIds, is_primary: true },
    }),
    apiClient.get<StudentClass>('student_classes', {
      filters: { student_id: studentIds, is_active: true },
    }),
  ]);

  // 주 보호자 Map 생성
  if (guardiansResponse.error) {
    console.warn('[enrichStudentsWithRelations] Guardian query failed:', guardiansResponse.error.message);
  } else if (guardiansResponse.data) {
    guardiansResponse.data.forEach((g: Guardian) => {
      if (!guardiansMap.has(g.student_id)) {
        guardiansMap.set(g.student_id, g.name);
      }
    });
  }

  // 대표반 Map 생성 (반 정보 추가 조회 필요)
  if (studentClassesResponse.error) {
    console.warn('[enrichStudentsWithRelations] StudentClass query failed:', studentClassesResponse.error.message);
  } else if (studentClassesResponse.data) {
    const classIds = [...new Set(studentClassesResponse.data.map((sc: StudentClass) => sc.class_id))];
    if (classIds.length > 0) {
      const classesResponse = await apiClient.get<Class>('academy_classes', {
        filters: { id: classIds },
      });
      if (classesResponse.error) {
        console.warn('[enrichStudentsWithRelations] Class details query failed:', classesResponse.error.message);
      } else if (classesResponse.data) {
        const classMap = new Map<string, string>(
          classesResponse.data.map((c: Class) => [c.id, c.name])
        );
        studentClassesResponse.data.forEach((sc: StudentClass) => {
          if (!studentClassMap.has(sc.student_id) && classMap.has(sc.class_id)) {
            studentClassMap.set(sc.student_id, classMap.get(sc.class_id)!);
          }
        });
      }
    }
  }

  return { guardiansMap, studentClassMap };
}

/**
 * ACADEMY_STUDENTS PostgREST 조인 select 문자열
 * [SSOT] student-transforms.ts의 ACADEMY_STUDENTS_SELECT와 동일
 * persons 쿼리에서 academy_students 조인 시 사용
 */
export const PERSONS_WITH_ACADEMY_SELECT = `
  *,
  academy_students (
    birth_date,
    gender,
    school_name,
    grade,
    class_name,
    attendance_number,
    father_phone,
    mother_phone,
    status,
    notes,
    profile_image_url,
    deleted_at,
    created_at,
    updated_at,
    created_by,
    updated_by
  )
`;
