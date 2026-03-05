/**
 * Student Queries
 *
 * [SSOT] 학생 도메인 쿼리 훅 및 fetch 함수
 * [불변 규칙] api-sdk를 통해서만 데이터 요청
 * [불변 규칙] tenant 변경 시 invalidateQueries() 자동 발생
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient, getApiContext } from '@api-sdk/core';
import {
  resolveStudentFilterIds,
  enrichStudentsWithRelations,
  PERSONS_WITH_ACADEMY_SELECT,
} from './student-list-core';
import type {
  StudentFilter,
  Student,
} from '@services/student-service';
import {
  extractAcademyData,
  mapPersonToStudent,
} from '@industry/academy';
import type { Person } from '@core/party';

/**
 * 학생 목록 조회 함수 (Hook의 queryFn 로직을 재사용)
 * [불변 규칙] useQuery 내부에서도 이 함수를 사용하여 일관성 유지
 *
 * 주의: 이 함수는 복잡한 필터링 로직을 포함하므로, 간단한 persons 조회가 필요한 경우
 * fetchPersons 함수를 사용하세요.
 */
export async function fetchStudents(
  tenantId: string,
  filter?: StudentFilter
): Promise<Student[]> {
  // [SSOT] 필터 ID 해석 (tag_ids, status/grade, class_id, soft-delete)
  const restrictedStudentIds = await resolveStudentFilterIds(tenantId, filter);
  if (restrictedStudentIds && restrictedStudentIds.length === 0) return [];

  const response = await apiClient.get<Person & { academy_students?: unknown }>('persons', {
    select: PERSONS_WITH_ACADEMY_SELECT,
    filters: {
      person_type: 'student',
      ...(filter?.search ? { search: filter.search } : {}),
      ...(restrictedStudentIds ? { id: restrictedStudentIds } : {}),
    },
    orderBy: { column: 'created_at', ascending: false },
    // [Phase 4] 서버 RPC로 ID 해석됨 — 결과 수에 맞는 limit 적용
    limit: restrictedStudentIds
      ? Math.max(10, restrictedStudentIds.length)
      : (filter?.search ? 500 : 1000),
  });

  if (response.error) {
    throw new Error(response.error.message);
  }

  const personsData = response.data || [];
  const studentIds = personsData.map((p: Person) => p.id);

  // [SSOT] enrichment (주 보호자 + 대표반)
  const { guardiansMap, studentClassMap } = await enrichStudentsWithRelations(studentIds);

  return personsData.map((person: Person & { academy_students?: unknown }) => {
    const academyData = extractAcademyData(person.academy_students);
    return mapPersonToStudent(person, academyData, {
      primary_guardian_name: guardiansMap.get(person.id) || undefined,
      primary_class_name: studentClassMap.get(person.id) || undefined,
    });
  });
}

/**
 * 학생 목록 조회 Hook
 * [불변 규칙] Zero-Trust: tenantId는 Context에서 자동으로 가져옴
 */
export function useStudents(filter?: StudentFilter) {
  const context = getApiContext();
  const tenantId = context.tenantId;

  return useQuery({
    queryKey: ['students', tenantId, filter],
    queryFn: () => fetchStudents(tenantId!, filter),
    enabled: !!tenantId,
    staleTime: 30 * 1000, // 30초간 캐시 유지 (검색 성능 최적화)
    gcTime: 5 * 60 * 1000, // 5분간 가비지 컬렉션 방지 (이전 cacheTime)
    // [성능 개선] 네트워크 오류 자동 재시도
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}

/**
 * 간단한 persons 조회 함수 (useQuery 내부에서 사용)
 * [불변 규칙] useQuery 내부에서도 이 함수를 사용하여 일관성 유지
 *
 * 주의: 이 함수는 복잡한 필터링 없이 persons 테이블만 조회합니다.
 * 학생 정보가 필요한 경우 fetchStudents를 사용하세요.
 */
export async function fetchPersons(
  tenantId: string,
  filter?: { person_type?: string; id?: string | string[]; created_at?: { gte?: string; lte?: string }; status?: string }
): Promise<Person[]> {
  if (!tenantId) return [];

  const filters: Record<string, unknown> = {};
  if (filter?.person_type) {
    filters.person_type = filter.person_type;
  }
  if (filter?.id) {
    filters.id = filter.id;
  }
  if (filter?.created_at) {
    filters.created_at = filter.created_at;
  }

  // [Phase 4] limit:5000 제거 — 페이징 사용 권장
  const response = await apiClient.get<Person>('persons', {
    filters,
    limit: 1000,
  });

  if (response.error) {
    throw new Error(response.error.message);
  }

  return (response.data || []);
}

/**
 * Persons 테이블 레코드 수 조회 (성능 최적화용)
 * [P2-PERF 추가] 전체 배열 조회 대신 count만 반환하여 네트워크/메모리 비용 절감
 *
 * @param tenantId 테넌트 ID
 * @param filter 필터 조건 (person_type, created_at 등)
 * @returns 레코드 수
 *
 * @example
 * // 학생 수만 조회 (전체 배열 fetch 없이)
 * const studentCount = await fetchPersonsCount(tenantId, { person_type: 'student' });
 */
export async function fetchPersonsCount(
  tenantId: string,
  filter?: { person_type?: string; created_at?: { gte?: string; lte?: string } }
): Promise<number> {
  if (!tenantId) return 0;

  const filters: Record<string, unknown> = {};
  if (filter?.person_type) {
    filters.person_type = filter.person_type;
  }
  if (filter?.created_at) {
    filters.created_at = filter.created_at;
  }

  // Supabase count 옵션 사용: limit: 0으로 데이터는 받지 않고 count만 조회
  const response = await apiClient.get<Person>('persons', {
    filters,
    count: 'exact', // 정확한 count 반환
    limit: 0, // 데이터 없이 count만 받기
  });

  if (response.error) {
    throw new Error(response.error.message);
  }

  return response.count ?? 0;
}

/**
 * 학생 목록 조회 Hook (서버 페이지네이션)
 * - 5천명+에서도 검색/필터/페이지네이션이 누락 없이 동작하도록 설계
 * - [불변 규칙] Zero-Trust: tenantId는 Context에서 자동으로 가져옴
 * - [불변 규칙] students(View)가 아닌 persons + academy_students 조인 사용
 */
export function useStudentsPaged(params: {
  filter?: StudentFilter;
  page: number;
  pageSize: number;
}) {
  const context = getApiContext();
  const tenantId = context.tenantId;
  const { filter, page, pageSize } = params;

  // 필터를 직렬화하여 쿼리 키 안정화 (객체 참조가 아닌 값 기반 비교)
  const filterKey = useMemo(() => {
    if (!filter) return '';
    return JSON.stringify(filter, Object.keys(filter).sort());
  }, [filter]);

  return useQuery({
    queryKey: ['students-paged', tenantId, filterKey, page, pageSize],
    queryFn: async () => {
      // [SSOT] 필터 ID 해석 (tag_ids, status/grade, class_id, soft-delete)
      const restrictedStudentIds = await resolveStudentFilterIds(tenantId!, filter);
      if (restrictedStudentIds && restrictedStudentIds.length === 0) return { students: [], totalCount: 0 };

      const from = Math.max(0, (page - 1) * pageSize);
      const to = from + pageSize - 1;

      const response = await apiClient.get<Person & { academy_students?: unknown }>('persons', {
        select: PERSONS_WITH_ACADEMY_SELECT,
        filters: {
          person_type: 'student',
          ...(filter?.search ? { search: filter.search } : {}),
          ...(restrictedStudentIds ? { id: restrictedStudentIds } : {}),
        },
        orderBy: { column: 'created_at', ascending: false },
        range: { from, to },
        count: 'exact',
      });

      if (response.error) throw new Error(response.error.message);

      const personsData = response.data || [];
      const totalCount = response.count ?? 0;
      const studentIds = personsData.map((p: Person) => p.id);

      // [SSOT] enrichment (주 보호자 + 대표반) - 현재 페이지 학생만
      const { guardiansMap, studentClassMap } = await enrichStudentsWithRelations(studentIds);

      const students = personsData.map((person: Person & { academy_students?: unknown }) => {
        const academyData = extractAcademyData(person.academy_students);
        return mapPersonToStudent(person, academyData, {
          primary_guardian_name: guardiansMap.get(person.id) || undefined,
          primary_class_name: studentClassMap.get(person.id) || undefined,
        });
      });

      return { students, totalCount };
    },
    enabled: !!tenantId && page > 0 && pageSize > 0,
    // [성능 개선 2026-01-27] staleTime 증가: 30초 → 2분 (학생 데이터는 자주 변경되지 않음)
    staleTime: 2 * 60 * 1000, // 2분간 캐시 유지
    gcTime: 5 * 60 * 1000, // 5분간 가비지 컬렉션 방지
    placeholderData: (previousData) => previousData, // 페이지 전환 시 이전 데이터 유지하여 부드러운 UX (React Query v5)
    refetchOnWindowFocus: false, // 윈도우 포커스 시 자동 리패치 비활성화 (성능 최적화)
    // [성능 개선] 네트워크 오류 자동 재시도
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}

/**
 * 학생 상세 조회 Hook
 * [불변 규칙] Zero-Trust: tenantId는 Context에서 자동으로 가져옴
 */
export function useStudent(studentId: string | null) {
  const context = getApiContext();
  const tenantId = context.tenantId;

  return useQuery({
    queryKey: ['student', tenantId, studentId],
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    queryFn: async () => {
      if (!studentId) return null;

      // students View를 사용하여 조회 (persons + academy_students 조인)
      interface PersonWithAcademyStudents extends Person {
        academy_students?: Array<Record<string, unknown>>;
      }
      // [소프트 삭제] 먼저 삭제되지 않은 학생인지 확인
      interface AcademyStudentIdRow {
        person_id: string;
      }
      const deletedCheckResponse = await apiClient.get<AcademyStudentIdRow>('academy_students', {
        select: 'person_id',
        filters: { person_id: studentId, deleted_at: null },
        limit: 1,
      });

      // 삭제된 학생이면 null 반환
      if (deletedCheckResponse.error || !deletedCheckResponse.data || deletedCheckResponse.data.length === 0) {
        return null;
      }

      const response = await apiClient.get<PersonWithAcademyStudents>('persons', {
        select: `
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
            created_at,
            updated_at,
            created_by,
            updated_by
          )
        `,
        filters: { id: studentId, person_type: 'student' },
        limit: 1,
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const person = response.data?.[0];
      if (!person) return null;

      // 데이터 변환 persons + academy_students -> Student
      const academyData = extractAcademyData(person.academy_students);
      return mapPersonToStudent(person, academyData) as Student;
    },
    enabled: !!tenantId && !!studentId,
  });
}
