/**
 * useStudent Hook
 *
 * React Query 기반 학생 관리 Hook
 * [불변 규칙] tenant 변경 시 invalidateQueries() 자동 발생
 * [불변 규칙] api-sdk를 통해서만 데이터 요청
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-restricted-syntax */

import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, getApiContext } from '@api-sdk/core';
import { toKST } from '@lib/date-utils'; // 기술문서 5-2: KST 변환 필수
import { normalizePhoneNumber } from '@lib/normalization'; // [불변 규칙] 전화번호 정규화
import { useSession } from '@hooks/use-auth';
import { createExecutionAuditRecord } from './execution-audit-utils';
import type {
  CreateStudentInput,
  UpdateStudentInput,
  StudentFilter,
  Student,
  StudentClass,
  Guardian,
  StudentConsultation,
} from '@services/student-service';
import type { Class } from '@services/class-service';
import type { Tag, TagAssignment } from '@core/tags';
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
      // 필터가 있으면 먼저 "ID 집합"을 좁혀서 persons 조회 정확도를 보장
      // (특히 status/grade는 academy_students에 있으므로, 최신 100명 제한에서 누락되는 문제 방지)
      let restrictedStudentIds: string[] | undefined;

      const intersect = (a: string[] | undefined, b: string[] | undefined): string[] | undefined => {
        if (!a && !b) return undefined;
        if (!a) return b;
        if (!b) return a;
        const setB = new Set(b);
        const next = a.filter((id) => setB.has(id));
        return next;
      };
      if (filter?.tag_ids && filter.tag_ids.length > 0) {
        const assignmentsResponse = await apiClient.get<TagAssignment>('tag_assignments', {
          filters: { entity_type: 'student', tag_id: filter.tag_ids },
        });

        if (assignmentsResponse.error) {
          throw new Error(assignmentsResponse.error.message);
        }

        const assignments = assignmentsResponse.data || [];
        if (assignments.length === 0) {
          return [];
        }

        // OR 조건: 선택된 태그 중 하나라도 가진 학생
        restrictedStudentIds = [...new Set(assignments.map((a) => a.entity_id))];
      }

      // status/grade 필터는 academy_students에서 person_id를 먼저 추출해 정확한 결과 보장
      // [소프트 삭제] deleted_at IS NULL인 학생만 조회 (삭제된 학생 제외)
      // [퇴원 vs 삭제 구분] withdrawn은 정상 조회됨 (상태 필터로 제어)
      if (filter?.status || filter?.grade) {
        interface AcademyStudentIdRow {
          person_id: string;
        }
        const academyFilters: Record<string, unknown> = {
          deleted_at: null,  // 삭제되지 않은 학생만
        };
        if (filter?.grade) academyFilters.grade = filter.grade;
        if (filter?.status) academyFilters.status = filter.status;

        const academyIdsResponse = await apiClient.get<AcademyStudentIdRow>('academy_students', {
          select: 'person_id',
          filters: academyFilters,
          limit: 5000,
        });

        if (academyIdsResponse.error) {
          throw new Error(academyIdsResponse.error.message);
        }

        const idsFromAcademy = [...new Set((academyIdsResponse.data || []).map((r) => r.person_id))];
        if (idsFromAcademy.length === 0) return [];
        restrictedStudentIds = intersect(restrictedStudentIds, idsFromAcademy);
        if (restrictedStudentIds && restrictedStudentIds.length === 0) return [];
      }

      // class_id 필터는 student_classes에서 student_id를 먼저 추출해 persons 조회량 절감
      // [버그 수정] 빈 문자열('') 또는 'all'은 필터로 사용하지 않음 (전체 조회 의미)
      if (filter?.class_id && filter.class_id.trim() !== '' && filter.class_id !== 'all') {
        const studentClassesResponse = await apiClient.get<StudentClass>('student_classes', {
          filters: { class_id: filter.class_id, is_active: true },
          limit: 5000,
        });

        if (studentClassesResponse.error) {
          throw new Error(studentClassesResponse.error.message);
        }

        const idsInClass = [...new Set((studentClassesResponse.data || []).map((sc: StudentClass) => sc.student_id))];
        if (idsInClass.length === 0) return [];
        restrictedStudentIds = intersect(restrictedStudentIds, idsInClass);
        if (restrictedStudentIds && restrictedStudentIds.length === 0) return [];
      }

      // [불변 규칙] 기술문서 정책: "Core Party 테이블 + 업종별 확장 테이블" 패턴 사용
      // persons + academy_students를 직접 조인하여 조회 (View 사용)
      // PostgREST가 View를 인식하지 못하는 문제로 인해 직접 조인 사용
      interface PersonWithAcademyStudents extends Person {
        academy_students?: Array<Record<string, unknown>>;
      }

      // [소프트 삭제] deleted_at IS NULL인 학생만 조회
      // restrictedStudentIds가 있든 없든 항상 삭제되지 않은 학생만 포함
      interface AcademyStudentIdRow {
        person_id: string;
      }
      const nonDeletedResponse = await apiClient.get<AcademyStudentIdRow>('academy_students', {
        select: 'person_id',
        filters: { deleted_at: null },
        limit: 5000,
      });

      if (!nonDeletedResponse.error && nonDeletedResponse.data) {
        const nonDeletedIds = nonDeletedResponse.data.map((r) => r.person_id);
        // restrictedStudentIds가 있으면 교집합, 없으면 nonDeletedIds 사용
        restrictedStudentIds = restrictedStudentIds
          ? intersect(restrictedStudentIds, nonDeletedIds)
          : nonDeletedIds;
      }

      // 삭제된 학생만 남은 경우 빈 배열 반환
      if (restrictedStudentIds && restrictedStudentIds.length === 0) return [];

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
            deleted_at,
            created_at,
            updated_at,
            created_by,
            updated_by
          )
        `,
        filters: {
          person_type: 'student',
          // [성능/정합성] apiClient의 search → name ilike 변환을 사용하여 서버에서 검색 처리
          ...(filter?.search ? { search: filter.search } : {}),
          ...(restrictedStudentIds ? { id: restrictedStudentIds } : {}),
        },
        orderBy: { column: 'created_at', ascending: false },
        // 제한된 경우에는 필요한 만큼만, 아니면 기본 100 (검색 시에는 조금 더)
        limit: restrictedStudentIds
          ? Math.max(10, Math.min(5000, restrictedStudentIds.length))
          // 요구사항: 전체 학생 5천명+에서도 검색/필터가 누락 없이 동작해야 함
          // 따라서 미제한 조회 시에도 상한을 5000으로 확장 (성능은 React Query 캐시로 완화)
          : (filter?.search ? 500 : 5000),
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const personsData = response.data || [];
      const studentIds = personsData.map((p: Person) => p.id);

      // [N+1 최적화] 학부모 정보와 학생 반 정보를 병렬로 조회
      const [guardiansResponse, studentClassesResponse] = await Promise.all([
        // 학부모 정보 조회 (주 보호자만)
        apiClient.get<Guardian>('guardians', {
          filters: { student_id: studentIds, is_primary: true },
        }),
        // 학생 반 정보 조회 (활성 반만)
        apiClient.get<StudentClass>('student_classes', {
          filters: { student_id: studentIds, is_active: true },
        }),
      ]);

      // 학부모 Map 생성
      const guardiansMap = new Map<string, string>();
      if (!guardiansResponse.error && guardiansResponse.data) {
        guardiansResponse.data.forEach((g: Guardian) => {
          if (!guardiansMap.has(g.student_id)) {
            guardiansMap.set(g.student_id, g.name);
          }
        });
      }

      // 대표반 정보 조회 (반 ID 추출 후 반 정보 조회)
      const studentClassMap = new Map<string, string>();
      if (!studentClassesResponse.error && studentClassesResponse.data) {
        const classIds = [...new Set(studentClassesResponse.data.map((sc: StudentClass) => sc.class_id))];
        if (classIds.length > 0) {
          const classesResponse = await apiClient.get<Class>('academy_classes', {
            filters: { id: classIds },
          });
          if (!classesResponse.error && classesResponse.data) {
            const classMap = new Map(classesResponse.data.map((c: Class) => [c.id, c.name]));
            studentClassesResponse.data.forEach((sc: StudentClass) => {
              if (!studentClassMap.has(sc.student_id) && classMap.has(sc.class_id)) {
                studentClassMap.set(sc.student_id, classMap.get(sc.class_id)!);
              }
            });
          }
        }
      }

      // 데이터 변환 persons + academy_students -> Student
      const students: Student[] = personsData.map((person: Person & { academy_students?: Array<Record<string, unknown>> | Record<string, unknown> }) => {
        // [P0-FIX] PostgREST는 1:1 관계에서 단일 객체를, 1:N 관계에서 배열을 반환
        const rawAcademyData = person.academy_students;
        const academyData: Record<string, unknown> = Array.isArray(rawAcademyData)
          ? (rawAcademyData[0] || {})
          : (rawAcademyData || {});
        return {
          id: person.id,
          tenant_id: person.tenant_id,
          industry_type: 'academy',
          name: person.name,
          birth_date: academyData.birth_date,
          gender: academyData.gender,
          phone: person.phone,
          attendance_number: academyData.attendance_number,
          email: person.email,
          father_phone: academyData.father_phone,
          mother_phone: academyData.mother_phone,
          address: person.address,
          school_name: academyData.school_name,
          grade: academyData.grade,
          status: academyData.status || 'active',
          notes: academyData.notes,
          profile_image_url: academyData.profile_image_url,
          created_at: person.created_at,
          updated_at: person.updated_at,
          created_by: academyData.created_by,
          updated_by: academyData.updated_by,
          // 아키텍처 문서 3.1.4 요구사항: 학부모, 대표반 정보 추가
          primary_guardian_name: guardiansMap.get(person.id) || undefined,
          primary_class_name: studentClassMap.get(person.id) || undefined,
        } as Student & { primary_guardian_name?: string; primary_class_name?: string };
      });

      // 클라이언트 측 필터링
      // status/grade/class_id는 위에서 ID 제한으로 처리됨 (여기서는 재필터링 불필요)

      // search는 서버에서 처리됨 (여기서는 재필터링 불필요)

      // 태그 필터는 상단에서 restrictedStudentIds로 1차 제한 처리 (여기서는 재필터링 불필요)

      return students;
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

  const response = await apiClient.get<Person>('persons', {
    filters,
    limit: 5000,
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
  const filterKey = React.useMemo(() => {
    if (!filter) return '';
    return JSON.stringify(filter, Object.keys(filter).sort());
  }, [filter]);

  return useQuery({
    queryKey: ['students-paged', tenantId, filterKey, page, pageSize],
    queryFn: async () => {
      let restrictedStudentIds: string[] | undefined;

      const intersect = (a: string[] | undefined, b: string[] | undefined): string[] | undefined => {
        if (!a && !b) return undefined;
        if (!a) return b;
        if (!b) return a;
        const setB = new Set(b);
        const next = a.filter((id) => setB.has(id));
        return next;
      };

      // 필터 조건별 API 호출을 병렬로 실행하여 성능 최적화
      const filterPromises: Promise<string[] | undefined>[] = [];

      // tag_ids → tag_assignments로 학생 ID 제한
      if (filter?.tag_ids && filter.tag_ids.length > 0) {
        filterPromises.push(
          apiClient.get<TagAssignment>('tag_assignments', {
            filters: { entity_type: 'student', tag_id: filter.tag_ids },
            limit: 5000,
          }).then((assignmentsResponse) => {
            if (assignmentsResponse.error) throw new Error(assignmentsResponse.error.message);
            const assignments = assignmentsResponse.data || [];
            if (assignments.length === 0) return [];
            return [...new Set(assignments.map((a) => a.entity_id))];
          })
        );
      } else {
        filterPromises.push(Promise.resolve(undefined));
      }

      // status/grade → academy_students에서 person_id 제한
      if (filter?.status || filter?.grade) {
        interface AcademyStudentIdRow { person_id: string; }
        // [소프트 삭제] 삭제되지 않은 학생만 조회
        const academyFilters: Record<string, unknown> = { deleted_at: null };
        if (filter?.grade) academyFilters.grade = filter.grade;
        if (filter?.status) academyFilters.status = filter.status;

        filterPromises.push(
          apiClient.get<AcademyStudentIdRow>('academy_students', {
            select: 'person_id',
            filters: academyFilters,
            limit: 5000,
          }).then((academyIdsResponse) => {
            if (academyIdsResponse.error) throw new Error(academyIdsResponse.error.message);
            const idsFromAcademy = [...new Set((academyIdsResponse.data || []).map((r) => r.person_id))];
            return idsFromAcademy.length === 0 ? [] : idsFromAcademy;
          })
        );
      } else {
        filterPromises.push(Promise.resolve(undefined));
      }

      // class_id → student_classes에서 student_id 제한
      // [버그 수정] 빈 문자열('') 또는 'all'은 필터로 사용하지 않음 (전체 조회 의미)
      if (filter?.class_id && filter.class_id.trim() !== '' && filter.class_id !== 'all') {
        filterPromises.push(
          apiClient.get<StudentClass>('student_classes', {
            filters: { class_id: filter.class_id, is_active: true },
            limit: 5000,
          }).then((studentClassesResponse) => {
            if (studentClassesResponse.error) throw new Error(studentClassesResponse.error.message);
            const idsInClass = [...new Set((studentClassesResponse.data || []).map((sc: StudentClass) => sc.student_id))];
            return idsInClass.length === 0 ? [] : idsInClass;
          })
        );
      } else {
        filterPromises.push(Promise.resolve(undefined));
      }

      // 모든 필터 조건을 병렬로 실행
      const [tagIds, academyIds, classIds] = await Promise.all(filterPromises);

      // 빈 결과가 있으면 즉시 반환
      if (tagIds && tagIds.length === 0) return { students: [], totalCount: 0 };
      if (academyIds && academyIds.length === 0) return { students: [], totalCount: 0 };
      if (classIds && classIds.length === 0) return { students: [], totalCount: 0 };

      // 교집합 계산
      restrictedStudentIds = intersect(tagIds, academyIds);
      restrictedStudentIds = intersect(restrictedStudentIds, classIds);
      if (restrictedStudentIds && restrictedStudentIds.length === 0) return { students: [], totalCount: 0 };

      // [소프트 삭제] deleted_at IS NULL인 학생만 조회
      // restrictedStudentIds가 있든 없든 항상 삭제되지 않은 학생만 포함
      interface AcademyStudentIdRow {
        person_id: string;
      }
      const nonDeletedResponse = await apiClient.get<AcademyStudentIdRow>('academy_students', {
        select: 'person_id',
        filters: { deleted_at: null },
        limit: 5000,
      });

      if (!nonDeletedResponse.error && nonDeletedResponse.data) {
        const nonDeletedIds = nonDeletedResponse.data.map((r) => r.person_id);
        // restrictedStudentIds가 있으면 교집합, 없으면 nonDeletedIds 사용
        restrictedStudentIds = restrictedStudentIds
          ? intersect(restrictedStudentIds, nonDeletedIds)
          : nonDeletedIds;
      }

      // 삭제된 학생만 남은 경우 빈 배열 반환
      if (restrictedStudentIds && restrictedStudentIds.length === 0) return { students: [], totalCount: 0 };

      interface PersonWithAcademyStudents extends Person {
        academy_students?: Array<Record<string, unknown>>;
      }

      const from = Math.max(0, (page - 1) * pageSize);
      const to = from + pageSize - 1;

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

      // 학부모(주 보호자) / 대표반 정보는 "현재 페이지" 학생만 조회 (성능 최적화)
      // 병렬 API 호출로 로딩 속도 개선
      const [guardiansResponse, studentClassesResponse] = await Promise.all([
        studentIds.length > 0
          ? apiClient.get<Guardian>('guardians', { filters: { student_id: studentIds, is_primary: true } })
          : Promise.resolve({ data: [] } as { data: Guardian[] }),
        studentIds.length > 0
          ? apiClient.get<StudentClass>('student_classes', { filters: { student_id: studentIds, is_active: true } })
          : Promise.resolve({ data: [] } as { data: StudentClass[] }),
      ]);

      // Map 생성 최적화: 한 번의 순회로 처리
      const guardiansMap = new Map<string, string>();
      if (!(guardiansResponse as any).error && (guardiansResponse as any).data) {
        (guardiansResponse as any).data.forEach((g: Guardian) => {
          if (!guardiansMap.has(g.student_id)) guardiansMap.set(g.student_id, g.name);
        });
      }

      const studentClassMap = new Map<string, string>();
      if (!(studentClassesResponse as any).error && (studentClassesResponse as any).data) {
        const classIds = [...new Set((studentClassesResponse as any).data.map((sc: StudentClass) => sc.class_id))];
        if (classIds.length > 0) {
          const classesResponse = await apiClient.get<Class>('academy_classes', { filters: { id: classIds } });
          if (!(classesResponse as any).error && (classesResponse as any).data) {
            const classMap = new Map<string, string>((classesResponse as any).data.map((c: Class) => [c.id, c.name]));
            (studentClassesResponse as any).data.forEach((sc: StudentClass) => {
              if (!studentClassMap.has(sc.student_id) && classMap.has(sc.class_id)) {
                studentClassMap.set(sc.student_id, classMap.get(sc.class_id)!);
              }
            });
          }
        }
      }

      const students: Student[] = personsData.map((person: Person & { academy_students?: Array<Record<string, unknown>> | Record<string, unknown> }) => {
        // [P0-FIX] PostgREST는 1:1 관계에서 단일 객체를, 1:N 관계에서 배열을 반환
        // academy_students가 배열인지 객체인지 확인하여 처리
        const rawAcademyData = person.academy_students;
        const academyData: Record<string, unknown> = Array.isArray(rawAcademyData)
          ? (rawAcademyData[0] || {})
          : (rawAcademyData || {});
        return {
          id: person.id,
          tenant_id: person.tenant_id,
          industry_type: 'academy',
          name: person.name,
          birth_date: academyData.birth_date,
          gender: academyData.gender,
          phone: person.phone,
          attendance_number: academyData.attendance_number,
          email: person.email,
          father_phone: academyData.father_phone,
          mother_phone: academyData.mother_phone,
          address: person.address,
          school_name: academyData.school_name,
          grade: academyData.grade,
          status: academyData.status || 'active',
          notes: academyData.notes,
          profile_image_url: academyData.profile_image_url,
          created_at: person.created_at,
          updated_at: person.updated_at,
          created_by: academyData.created_by,
          updated_by: academyData.updated_by,
          primary_guardian_name: guardiansMap.get(person.id) || undefined,
          primary_class_name: studentClassMap.get(person.id) || undefined,
        } as Student & { primary_guardian_name?: string; primary_class_name?: string };
      });

      return { students, totalCount };
    },
    enabled: !!tenantId && page > 0 && pageSize > 0,
    staleTime: 30 * 1000, // 30초간 캐시 유지
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
      // [불변 규칙] academy_students는 1:1 관계이므로 배열 또는 객체로 반환될 수 있음
      // PostgREST의 관계 조회 결과는 상황에 따라 배열 또는 객체로 반환됨
      let academyData: Record<string, unknown> = {};
      if (person.academy_students) {
        if (Array.isArray(person.academy_students)) {
          // 배열인 경우 첫 번째 요소 사용
          academyData = person.academy_students.length > 0 ? person.academy_students[0] : {};
        } else {
          // 객체인 경우 직접 사용
          academyData = person.academy_students as Record<string, unknown>;
        }
      }

      return {
        id: person.id,
        tenant_id: person.tenant_id,
        industry_type: 'academy',
        name: person.name,
        birth_date: academyData.birth_date ?? undefined,
        gender: academyData.gender ?? undefined,
        phone: person.phone ?? undefined,
        attendance_number: academyData.attendance_number ?? undefined,
        email: person.email ?? undefined,
        father_phone: academyData.father_phone ?? undefined,
        mother_phone: academyData.mother_phone ?? undefined,
        address: person.address ?? undefined,
        school_name: academyData.school_name ?? undefined,
        grade: academyData.grade ?? undefined,
        status: academyData.status || 'active',
        notes: academyData.notes ?? undefined,
        profile_image_url: academyData.profile_image_url ?? undefined,
        created_at: person.created_at,
        updated_at: person.updated_at,
        created_by: academyData.created_by ?? undefined,
        updated_by: academyData.updated_by ?? undefined,
      } as Student;
    },
    enabled: !!tenantId && !!studentId,
  });
}

/**
 * 학생 생성 Hook
 * [불변 규칙] Zero-Trust: tenantId는 Context에서 자동으로 가져옴
 * [불변 규칙] students는 View이므로 persons + academy_students를 각각 생성해야 함
 */
export function useCreateStudent() {
  const queryClient = useQueryClient();
  const context = getApiContext();
  const tenantId = context.tenantId;
  const industryType = context.industryType || 'academy';
  const { data: session } = useSession();

  return useMutation({
    mutationFn: async (input: CreateStudentInput): Promise<Student & { restored?: boolean }> => {
      const startTime = Date.now();

      // [불변 규칙] 전화번호는 반드시 정규화 (복원 체크 전에 먼저 수행)
      const normalizedPhone = normalizePhoneNumber(input.phone);
      const normalizedFatherPhone = normalizePhoneNumber(input.father_phone);
      const normalizedMotherPhone = normalizePhoneNumber(input.mother_phone);

      // [소프트 삭제 복원] 동일한 이름+전화번호를 가진 삭제된 학생이 있는지 확인
      if (input.name && normalizedPhone && tenantId) {
        interface DeletedStudentRow {
          person_id: string;
          name: string;
          phone: string;
          deleted_at: string;
        }
        const deletedResponse = await apiClient.callRPC<DeletedStudentRow[]>('find_deleted_student', {
          p_tenant_id: tenantId,
          p_name: input.name,
          p_phone: normalizedPhone,
        });

        if (!deletedResponse.error && deletedResponse.data && deletedResponse.data.length > 0) {
          // 삭제된 학생 발견 - 복원 처리
          const deletedStudent = deletedResponse.data[0];

          // 복원 (deleted_at = NULL, status = active)
          await apiClient.callRPC('restore_deleted_student', {
            p_person_id: deletedStudent.person_id,
            p_status: input.status || 'active',
          });

          // 추가 정보 업데이트 (입력된 새 정보로)
          await apiClient.patch('persons', deletedStudent.person_id, {
            address: input.address,
          });

          await apiClient.patch('academy_students', deletedStudent.person_id, {
            birth_date: input.birth_date,
            gender: input.gender,
            school_name: input.school_name,
            grade: input.grade,
            attendance_number: input.attendance_number,
            father_phone: normalizedFatherPhone,
            mother_phone: normalizedMotherPhone,
            notes: input.notes,
            profile_image_url: input.profile_image_url,
          });

          // Execution Audit 기록
          if (session?.user?.id) {
            const durationMs = Date.now() - startTime;
            await createExecutionAuditRecord(
              {
                operation_type: 'student.restore',
                status: 'success',
                summary: `${input.name} 학생 복원 완료 (기존 삭제 데이터 재활성화)`,
                details: {
                  student_id: deletedStudent.person_id,
                  original_deleted_at: deletedStudent.deleted_at,
                },
                reference: {
                  entity_type: 'student',
                  entity_id: deletedStudent.person_id,
                },
                duration_ms: durationMs,
              },
              session.user.id
            );
          }

          // 복원된 학생 정보 반환
          return {
            id: deletedStudent.person_id,
            tenant_id: tenantId,
            industry_type: industryType,
            name: input.name,
            phone: normalizedPhone,
            status: input.status || 'active',
            restored: true,  // 복원 여부 플래그
          } as Student & { restored: boolean };
        }
      }

      // 1. persons 테이블에 생성 (공통 필드)
      const personResponse = await apiClient.post<Person>('persons', {
        name: input.name,
        email: input.email,
        phone: normalizedPhone,
        address: input.address,
        person_type: 'student',
      });

      if (personResponse.error) {
        throw new Error(personResponse.error.message);
      }

      const person = personResponse.data!;

      // 2. 출결번호 자동 생성 로직 (중복 방지)
      // [개선] DB의 generate_attendance_number 함수 사용하여 Race Condition 방지
      let attendanceNumber = input.attendance_number;
      if (!attendanceNumber && input.phone && tenantId) {
        // 데이터베이스 함수를 통한 원자적 생성
        const generateResponse = await apiClient.callRPC('generate_attendance_number', {
          p_tenant_id: tenantId,
          p_phone: input.phone,
        });

        if (!generateResponse.error && generateResponse.data) {
          attendanceNumber = generateResponse.data as string;
        }
      }

      // 3. academy_students 테이블에 확장 정보 추가
      interface AcademyStudent {
        person_id: string;
        tenant_id: string;
        birth_date?: string;
        gender?: string;
        school_name?: string;
        grade?: string;
        class_name?: string;
        attendance_number?: string;
        father_phone?: string;
        mother_phone?: string;
        status?: string;
        notes?: string;
        profile_image_url?: string;
        created_at: string;
        updated_at: string;
        created_by?: string;
        updated_by?: string;
      }
      const academyResponse = await apiClient.post<AcademyStudent>('academy_students', {
        person_id: person.id,
        birth_date: input.birth_date,
        gender: input.gender,
        school_name: input.school_name,
        grade: input.grade,
        attendance_number: attendanceNumber,
        father_phone: normalizedFatherPhone,
        mother_phone: normalizedMotherPhone,
        status: input.status || 'active',
        notes: input.notes,
        profile_image_url: input.profile_image_url,
      });

      if (academyResponse.error) {
        // 롤백: persons 삭제
        await apiClient.delete('persons', person.id);
        throw new Error(academyResponse.error.message);
      }

      // [N+1 최적화] 4. 보호자 정보와 태그 연결을 병렬로 처리
      const guardianPromises = (input.guardians && input.guardians.length > 0)
        ? input.guardians.map((guardian) =>
            apiClient.post<Guardian>('guardians', {
              student_id: person.id,
              ...guardian,
            })
          )
        : [];

      const tagPromises = (input.tag_ids && input.tag_ids.length > 0)
        ? input.tag_ids.map((tagId) =>
            apiClient.post('tag_assignments', {
              entity_id: person.id,
              entity_type: 'student',
              tag_id: tagId,
            })
          )
        : [];

      // 보호자와 태그 생성을 병렬로 실행
      const results = await Promise.all([...guardianPromises, ...tagPromises]);

      // 에러 확인 (하나라도 실패하면 롤백)
      const failedResult = results.find((r) => r.error);
      if (failedResult) {
        // 롤백: persons 및 academy_students는 cascade로 삭제됨
        await apiClient.delete('persons', person.id);
        throw new Error(failedResult.error?.message || 'Failed to create guardian or tag');
      }

      // 6. Execution Audit 기록 생성 (액티비티.md 3.3, 12 참조)
      if (session?.user?.id) {
        const durationMs = Date.now() - startTime;
        await createExecutionAuditRecord(
          {
            operation_type: 'student.register',
            status: 'success',
            summary: `${input.name} 학생 등록 완료`,
            details: {
              student_id: person.id,
            },
            reference: {
              entity_type: 'student',
              entity_id: person.id,
            },
            duration_ms: durationMs,
          },
          session.user.id
        );
      }

      // 7. 결과 반환 (persons + academy_students 조합)
      return {
        id: person.id,
        tenant_id: person.tenant_id,
        industry_type: industryType,
        name: person.name,
        birth_date: academyResponse.data?.birth_date,
        gender: academyResponse.data?.gender,
        phone: person.phone,
        attendance_number: academyResponse.data?.attendance_number,
        email: person.email,
        father_phone: academyResponse.data?.father_phone,
        mother_phone: academyResponse.data?.mother_phone,
        address: person.address,
        school_name: academyResponse.data?.school_name,
        grade: academyResponse.data?.grade,
        status: academyResponse.data?.status || 'active',
        notes: academyResponse.data?.notes,
        profile_image_url: academyResponse.data?.profile_image_url,
        created_at: person.created_at,
        updated_at: person.updated_at,
        created_by: academyResponse.data?.created_by,
        updated_by: academyResponse.data?.updated_by,
      } as Student;
    },
    onSuccess: () => {
      // 학생 목록 쿼리 무효화
      queryClient.invalidateQueries({ queryKey: ['students', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['students-paged', tenantId] });
    },
  });
}

/**
 * 학생 일괄 등록 Hook (요청)
 * [요구사항] 학생 일괄 등록(엑셀)
 */
export function useBulkCreateStudents() {
  const queryClient = useQueryClient();
  const context = getApiContext();
  const tenantId = context.tenantId;
  const industryType = context.industryType || 'academy';

  return useMutation({
    mutationFn: async (students: CreateStudentInput[]) => {
      // [N+1 최적화] 일괄 등록을 병렬 처리 (최대 10개씩 배치)
      const BATCH_SIZE = 10;
      const results: Student[] = [];
      const errors: Array<{ index: number; error: string }> = [];

      interface AcademyStudent {
        person_id: string;
        tenant_id: string;
        birth_date?: string;
        gender?: string;
        school_name?: string;
        grade?: string;
        class_name?: string;
        status?: string;
        notes?: string;
        profile_image_url?: string;
        created_at: string;
        updated_at: string;
        created_by?: string;
        updated_by?: string;
      }

      // 배치 단위로 처리
      for (let batchStart = 0; batchStart < students.length; batchStart += BATCH_SIZE) {
        const batch = students.slice(batchStart, batchStart + BATCH_SIZE);

        // [N+1 최적화] 1. 배치 내 persons 생성을 병렬로 처리
        const personPromises = batch.map((student) =>
          apiClient.post<Person>('persons', {
            name: student.name,
            email: student.email,
            phone: student.phone,
            address: student.address,
            person_type: 'student',
          })
        );

        const personResponses = await Promise.all(personPromises);

        // [N+1 최적화] 2. 성공한 persons에 대해 academy_students 생성을 병렬로 처리
        const academyPromises: Promise<any>[] = [];
        const validPersons: { index: number; person: Person; student: CreateStudentInput }[] = [];

        personResponses.forEach((response, i) => {
          const globalIndex = batchStart + i;
          if (response.error) {
            errors.push({ index: globalIndex, error: response.error.message });
          } else if (response.data) {
            validPersons.push({
              index: globalIndex,
              person: response.data,
              student: batch[i],
            });
            academyPromises.push(
              apiClient.post<AcademyStudent>('academy_students', {
                person_id: response.data.id,
                birth_date: batch[i].birth_date,
                gender: batch[i].gender,
                school_name: batch[i].school_name,
                grade: batch[i].grade,
                status: batch[i].status || 'active',
                notes: batch[i].notes,
                profile_image_url: batch[i].profile_image_url,
              })
            );
          }
        });

        const academyResponses = await Promise.all(academyPromises);

        // 결과 처리
        academyResponses.forEach((academyResponse, i) => {
          const { index: globalIndex, person, student } = validPersons[i];

          if (academyResponse.error) {
            // 롤백: persons 삭제 (비동기로 처리, 에러 무시)
            apiClient.delete('persons', person.id).catch(() => {});
            errors.push({ index: globalIndex, error: academyResponse.error.message });
          } else {
            results.push({
              id: person.id,
              tenant_id: person.tenant_id,
              industry_type: industryType,
              name: person.name,
              birth_date: academyResponse.data?.birth_date,
              gender: academyResponse.data?.gender,
              phone: person.phone,
              email: person.email,
              address: person.address,
              school_name: academyResponse.data?.school_name,
              grade: academyResponse.data?.grade,
              status: academyResponse.data?.status || 'active',
              notes: academyResponse.data?.notes,
              profile_image_url: academyResponse.data?.profile_image_url,
              created_at: person.created_at,
              updated_at: person.updated_at,
              created_by: academyResponse.data?.created_by,
              updated_by: academyResponse.data?.updated_by,
            } as Student);
          }
        });
      }

      if (errors.length > 0) {
        console.warn('일부 학생 등록 실패:', errors);
      }

      return { results, errors };
    },
    onSuccess: () => {
      // 학생 목록 쿼리 무효화
      queryClient.invalidateQueries({ queryKey: ['students', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['students-paged', tenantId] });
    },
  });
}

/**
 * 학생 수정 Hook
 * [불변 규칙] Zero-Trust: tenantId는 Context에서 자동으로 가져옴
 * [불변 규칙] students는 View이므로 persons와 academy_students를 각각 업데이트해야 함
 */
export function useUpdateStudent() {
  const queryClient = useQueryClient();
  const context = getApiContext();
  const tenantId = context.tenantId;
  const { data: session } = useSession();

  return useMutation({
    mutationFn: async ({
      studentId,
      input,
    }: {
      studentId: string;
      input: UpdateStudentInput;
    }) => {
      const startTime = Date.now();

      // [불변 규칙] 전화번호는 반드시 정규화하여 저장
      const normalizedPhone = input.phone !== undefined ? (normalizePhoneNumber(input.phone) || undefined) : undefined;
      const normalizedFatherPhone = input.father_phone !== undefined ? (normalizePhoneNumber(input.father_phone) || undefined) : undefined;
      const normalizedMotherPhone = input.mother_phone !== undefined ? (normalizePhoneNumber(input.mother_phone) || undefined) : undefined;

      // 1. persons 테이블 업데이트 (공통 필드)
      const personUpdate: Partial<{ name?: string; email?: string; phone?: string; address?: string }> = {};
      if (input.name !== undefined) personUpdate.name = input.name;
      if (input.email !== undefined) personUpdate.email = input.email;
      if (normalizedPhone !== undefined) personUpdate.phone = normalizedPhone;
      if (input.address !== undefined) personUpdate.address = input.address;

      if (Object.keys(personUpdate).length > 0) {
        const personResponse = await apiClient.patch('persons', studentId, personUpdate);
        if (personResponse.error) {
          throw new Error(personResponse.error.message);
        }
      }

      // 2. academy_students 테이블 업데이트 (업종 특화 필드)
      const academyUpdate: Partial<Student> = {};
      if (input.birth_date !== undefined) academyUpdate.birth_date = input.birth_date;
      if (input.gender !== undefined) academyUpdate.gender = input.gender;
      if (input.school_name !== undefined) academyUpdate.school_name = input.school_name;
      if (input.grade !== undefined) academyUpdate.grade = input.grade;
      if (input.attendance_number !== undefined) academyUpdate.attendance_number = input.attendance_number;
      if (normalizedFatherPhone !== undefined) academyUpdate.father_phone = normalizedFatherPhone;
      if (normalizedMotherPhone !== undefined) academyUpdate.mother_phone = normalizedMotherPhone;
      if (input.status !== undefined) academyUpdate.status = input.status;
      if (input.notes !== undefined) academyUpdate.notes = input.notes;
      if (input.profile_image_url !== undefined) academyUpdate.profile_image_url = input.profile_image_url;

      if (Object.keys(academyUpdate).length > 0) {
        // academy_students는 person_id를 PK로 사용하므로 person_id로 조회 후 업데이트
        interface AcademyStudent {
          person_id: string;
          tenant_id: string;
          birth_date?: string;
          gender?: string;
          school_name?: string;
          grade?: string;
          class_name?: string;
          attendance_number?: string;
          father_phone?: string;
          mother_phone?: string;
          status?: string;
          notes?: string;
          profile_image_url?: string;
          created_at: string;
          updated_at: string;
          created_by?: string;
          updated_by?: string;
        }
        // [소프트 삭제] 삭제되지 않은 학생만 조회
        const academyResponse = await apiClient.get<AcademyStudent>('academy_students', {
          filters: { person_id: studentId, deleted_at: null },
          limit: 1,
        });

        if (academyResponse.error) {
          throw new Error(academyResponse.error.message);
        }

        const academyStudent = academyResponse.data?.[0];
        if (academyStudent) {
          const updateResponse = await apiClient.patch('academy_students', academyStudent.person_id, academyUpdate);
          if (updateResponse.error) {
            throw new Error(updateResponse.error.message);
          }
        }
      }

      // 3. 업데이트된 데이터 조회하여 반환
      const studentResponse = await apiClient.get<Person & { academy_students?: Array<Record<string, unknown>> }>('persons', {
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

      if (studentResponse.error) {
        throw new Error(studentResponse.error.message);
      }

      const person = studentResponse.data?.[0];
      if (!person) {
        throw new Error('Student not found');
      }

      // [P0-FIX] PostgREST는 1:1 관계에서 단일 객체를, 1:N 관계에서 배열을 반환
      const rawAcademyData = person.academy_students;
      const academyData: Record<string, unknown> = Array.isArray(rawAcademyData)
        ? (rawAcademyData[0] || {})
        : (rawAcademyData || {});
      const updatedStudent = {
        id: person.id,
        tenant_id: person.tenant_id,
        industry_type: 'academy',
        name: person.name,
        birth_date: academyData.birth_date,
        gender: academyData.gender,
        phone: person.phone,
        attendance_number: academyData.attendance_number,
        email: person.email,
        father_phone: academyData.father_phone,
        mother_phone: academyData.mother_phone,
        address: person.address,
        school_name: academyData.school_name,
        grade: academyData.grade,
        status: academyData.status || 'active',
        notes: academyData.notes,
        profile_image_url: academyData.profile_image_url,
        created_at: person.created_at,
        updated_at: person.updated_at,
        created_by: academyData.created_by,
        updated_by: academyData.updated_by,
      } as Student;

      // Execution Audit 기록 생성 (액티비티.md 3.3, 12 참조)
      if (session?.user?.id) {
        const durationMs = Date.now() - startTime;
        // 변경된 필드 추출
        const changedFields: string[] = [];
        if (input.name !== undefined) changedFields.push('이름');
        if (input.phone !== undefined) changedFields.push('전화번호');
        if (input.email !== undefined) changedFields.push('이메일');
        if (input.address !== undefined) changedFields.push('주소');
        if (input.birth_date !== undefined) changedFields.push('생년월일');
        if (input.gender !== undefined) changedFields.push('성별');
        if (input.school_name !== undefined) changedFields.push('학교명');
        if (input.grade !== undefined) changedFields.push('학년');
        if (input.status !== undefined) changedFields.push('상태');
        if (input.notes !== undefined) changedFields.push('비고');
        if (input.profile_image_url !== undefined) changedFields.push('프로필 이미지');

        await createExecutionAuditRecord(
          {
            operation_type: 'student.update',
            status: 'success',
            summary: `${updatedStudent.name} 학생 정보 수정 완료 (${changedFields.join(', ')})`,
            details: {
              student_id: studentId,
            },
            reference: {
              entity_type: 'student',
              entity_id: studentId,
            },
            duration_ms: durationMs,
          },
          session.user.id
        );
      }

      return updatedStudent;
    },
    onSuccess: (data) => {
      // 학생 목록 및 상세 쿼리 무효화
      // students-paged 쿼리도 무효화하여 테이블에 즉시 반영되도록 함
      queryClient.invalidateQueries({ queryKey: ['students', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['students-paged', tenantId] });
      queryClient.invalidateQueries({
        queryKey: ['student', tenantId, data.id],
      });
      // [P0-FIX] 통계 카드도 무효화 (status 변경 시 통계 즉시 반영)
      queryClient.invalidateQueries({ queryKey: ['student-stats', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['student-stats-cards', tenantId] });
    },
  });
}

/**
 * 학생 삭제 Hook (Soft delete: deleted_at 타임스탬프 설정)
 * [퇴원 vs 삭제 구분]
 * - 퇴원: status = 'withdrawn', 목록에서 조회 가능 (필터로)
 * - 삭제: deleted_at IS NOT NULL, 목록에서 완전히 숨김
 * [불변 규칙] Zero-Trust: tenantId는 Context에서 자동으로 가져옴
 */
export function useDeleteStudent() {
  const queryClient = useQueryClient();
  const context = getApiContext();
  const tenantId = context.tenantId;
  const { data: session } = useSession();

  return useMutation({
    mutationFn: async (studentId: string) => {
      const startTime = Date.now();

      // 학생 정보 조회 (Execution Audit 기록용)
      const studentResponse = await apiClient.get<Person>('persons', {
        filters: { id: studentId, person_type: 'student' },
        limit: 1,
      });

      const studentName = studentResponse.data?.[0]?.name || '알 수 없음';

      // Soft delete: deleted_at 타임스탬프 설정
      // [불변 규칙] students는 View이므로 academy_students를 직접 업데이트해야 함
      const deleteResponse = await apiClient.callRPC('soft_delete_student', {
        p_person_id: studentId,
      });

      if (deleteResponse.error) {
        throw new Error(deleteResponse.error.message);
      }

      // Execution Audit 기록 생성 (액티비티.md 3.3, 12 참조)
      if (session?.user?.id) {
        const durationMs = Date.now() - startTime;
        await createExecutionAuditRecord(
          {
            operation_type: 'student.delete',
            status: 'success',
            summary: `${studentName} 학생 삭제 완료`,
            details: {
              student_id: studentId,
            },
            reference: {
              entity_type: 'student',
              entity_id: studentId,
            },
            duration_ms: durationMs,
          },
          session.user.id
        );
      }

      return;
    },
    onSuccess: () => {
      // 학생 목록 쿼리 무효화
      queryClient.invalidateQueries({ queryKey: ['students', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['students-paged', tenantId] });
      // 선택 학생 상세도 무효화 (레이어 메뉴에서 바로 반영)
      queryClient.invalidateQueries({ queryKey: ['student', tenantId] });
    },
  });
}

/**
 * 보호자 목록 조회 함수 (Hook의 queryFn 로직을 재사용)
 * [불변 규칙] useQuery 내부에서도 이 함수를 사용하여 일관성 유지
 */
export async function fetchGuardians(
  tenantId: string,
  filter?: { student_id?: string | string[]; is_primary?: boolean }
): Promise<Guardian[]> {
  if (!tenantId) return [];

  const filters: Record<string, unknown> = {};
  if (filter?.student_id) {
    filters.student_id = filter.student_id;
  }
  if (filter?.is_primary !== undefined) {
    filters.is_primary = filter.is_primary;
  }

  const response = await apiClient.get<Guardian>('guardians', {
    filters,
    orderBy: { column: 'is_primary', ascending: false },
  });

  if (response.error) {
    throw new Error(response.error.message);
  }

  return (response.data || []);
}

/**
 * 보호자 목록 조회 Hook
 * [불변 규칙] Zero-Trust: tenantId는 Context에서 자동으로 가져옴
 */
export function useGuardians(studentId: string | null) {
  const context = getApiContext();
  const tenantId = context.tenantId;

  return useQuery({
    queryKey: ['guardians', tenantId, studentId],
    queryFn: () => fetchGuardians(tenantId!, studentId ? { student_id: studentId } : undefined),
    enabled: !!tenantId && !!studentId,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}

/**
 * 학생 태그 목록 조회 Hook (core-tags 사용)
 * [불변 규칙] Zero-Trust: tenantId는 Context에서 자동으로 가져옴
 * TODO: API SDK를 통해 태그 조회 구현 필요
 */
export function useStudentTags() {
  const context = getApiContext();
  const tenantId = context.tenantId;

  return useQuery<Array<{ id: string; name: string; color: string }>>({
    queryKey: ['tags', tenantId, 'student'],
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    queryFn: async (): Promise<Array<{ id: string; name: string; color: string }>> => {
      if (!tenantId) return [];

      const response = await apiClient.get<Tag>('tags', {
        filters: { entity_type: 'student' },
        // 최신 태그가 먼저 보이도록 (요구사항)
        orderBy: { column: 'created_at', ascending: false },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      // 안전장치: 서버 정렬이 보장되지 않는 환경에서도 최신이 먼저 오도록 클라이언트에서도 한 번 더 정렬
      const sorted = [...(response.data || [])].sort((a: Tag, b: Tag) => {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      return sorted.map((tag: Tag) => ({
        id: tag.id,
        name: tag.name,
        // 정본 규칙: 하드코딩 금지, CSS 변수 사용
        // tag.color이 없으면 CSS 변수 문자열을 반환 (런타임에 CSS 변수 값으로 해석됨)
        color: tag.color || 'var(--color-primary)',
      }));
    },
    enabled: !!tenantId,
  });
}

/**
 * 학생의 태그 조회 Hook (core-tags 사용)
 * [불변 규칙] Zero-Trust: tenantId는 Context에서 자동으로 가져옴
 * TODO: API SDK를 통해 태그 조회 구현 필요
 */
export function useStudentTagsByStudent(studentId: string | null) {
  const context = getApiContext();
  const tenantId = context.tenantId;

  return useQuery<Array<{ id: string; name: string; color: string }>>({
    queryKey: ['tags', tenantId, 'student', studentId],
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    queryFn: async (): Promise<Array<{ id: string; name: string; color: string }>> => {
      if (!studentId || !tenantId) return [];

      // tag_assignments를 통해 학생의 태그 조회
      const assignmentsResponse = await apiClient.get<TagAssignment>('tag_assignments', {
        filters: { entity_id: studentId, entity_type: 'student' },
      });

      if (assignmentsResponse.error) {
        throw new Error(assignmentsResponse.error.message);
      }

      const assignments = assignmentsResponse.data || [];
      if (assignments.length === 0) return [];

      // 태그 ID 배열 추출
      const tagIds = assignments.map((a: TagAssignment) => a.tag_id);

      // 태그 상세 정보 조회
      const tagsResponse = await apiClient.get<Tag[]>('tags', {
        filters: { id: tagIds },
      });

      if (tagsResponse.error) {
        throw new Error(tagsResponse.error.message);
      }

      return (tagsResponse.data || []).map((tag) => {
        const tagData = tag as unknown as Tag;
        return {
          id: tagData.id,
          name: tagData.name,
          // 정본 규칙: 하드코딩 금지, CSS 변수 사용
          // tag.color이 없으면 CSS 변수 문자열을 반환 (런타임에 CSS 변수 값으로 해석됨)
          color: tagData.color || 'var(--color-primary)',
        };
      });
    },
    enabled: !!tenantId && !!studentId,
  });
}

/**
 * 전체 학생 태그 할당 정보 조회 Hook (통계용)
 * [불변 규칙] Zero-Trust: tenantId는 Context에서 자동으로 가져옴
 */
export function useAllStudentTagAssignments() {
  const context = getApiContext();
  const tenantId = context.tenantId;

  return useQuery<Array<{ student_id: string; tag_id: string }>>({
    queryKey: ['tag_assignments', tenantId, 'student', 'all'],
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    queryFn: async (): Promise<Array<{ student_id: string; tag_id: string }>> => {
      if (!tenantId) return [];

      const assignmentsResponse = await apiClient.get<TagAssignment>('tag_assignments', {
        filters: { entity_type: 'student' },
        limit: 5000,
      });

      if (assignmentsResponse.error) {
        throw new Error(assignmentsResponse.error.message);
      }

      return (assignmentsResponse.data || []).map((a: TagAssignment) => ({
        student_id: a.entity_id,
        tag_id: a.tag_id,
      }));
    },
    enabled: !!tenantId,
  });
}

/**
 * 상담기록 목록 조회 함수 (Hook의 queryFn 로직을 재사용)
 * [불변 규칙] useQuery 내부에서도 이 함수를 사용하여 일관성 유지
 */
export async function fetchConsultations(
  tenantId: string,
  filter?: { student_id?: string; consultation_date?: { gte?: string; lte?: string } }
): Promise<StudentConsultation[]> {
  const filters: Record<string, unknown> = {};
  if (filter?.student_id) {
    filters.student_id = filter.student_id;
  }
  if (filter?.consultation_date) {
    filters.consultation_date = filter.consultation_date;
  }

  const response = await apiClient.get<StudentConsultation>('student_consultations', {
    filters,
    orderBy: { column: 'consultation_date', ascending: false },
    limit: 100,
  });

  if (response.error) {
    throw new Error(response.error.message);
  }

  return (response.data || []);
}

/**
 * 상담기록 목록 조회 Hook
 * [불변 규칙] Zero-Trust: tenantId는 Context에서 자동으로 가져옴
 */
export function useConsultations(studentId: string | null) {
  const context = getApiContext();
  const tenantId = context.tenantId;

  return useQuery({
    queryKey: ['consultations', tenantId, studentId],
    queryFn: () => fetchConsultations(tenantId!, studentId ? { student_id: studentId } : undefined),
    enabled: !!tenantId && !!studentId,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}

/**
 * 전체 상담기록 목록 조회 Hook (학생 필터 없음)
 * [불변 규칙] Zero-Trust: tenantId는 Context에서 자동으로 가져옴
 */
export function useAllConsultations() {
  const context = getApiContext();
  const tenantId = context.tenantId;

  return useQuery({
    queryKey: ['consultations', tenantId, 'all'],
    queryFn: () => fetchConsultations(tenantId!, undefined),
    enabled: !!tenantId,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}

/**
 * 상담기록 생성 Hook
 */
export function useCreateConsultation() {
  const queryClient = useQueryClient();
  const context = getApiContext();
  const tenantId = context.tenantId;
  const { data: session } = useSession();

  return useMutation({
    mutationFn: async ({
      studentId,
      consultation,
      userId,
    }: {
      studentId: string;
      consultation: Omit<StudentConsultation, 'id' | 'tenant_id' | 'student_id' | 'created_at' | 'updated_at'>;
      userId: string;
    }) => {
      const startTime = Date.now();
      const response = await apiClient.post('student_consultations', {
        student_id: studentId,
        ...consultation,
        created_by: userId,
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      // Execution Audit 기록 생성 (액티비티.md 3.3, 12 참조)
      if (session?.user?.id && response.data) {
        const durationMs = Date.now() - startTime;
        const consultationData = response.data as StudentConsultation;
        const consultationType = (consultation as any).consultation_type || (consultation as any).type || '일반';
        await createExecutionAuditRecord(
          {
            operation_type: 'consultation.create',
            status: 'success',
            summary: `상담기록 생성 완료 (${consultationType})`,
            details: {
              consultation_id: consultationData.id,
              student_id: studentId,
              consultation_type: consultationType,
            },
            reference: {
              entity_type: 'consultation',
              entity_id: consultationData.id,
            },
            duration_ms: durationMs,
          },
          session.user.id
        );
      }

      return response.data!;
    },
    onSuccess: (_, variables) => {
      // 특정 학생의 상담 캐시 무효화
      queryClient.invalidateQueries({ queryKey: ['consultations', tenantId, variables.studentId] });
      // [캐시 동기화] 전체 상담 캐시도 무효화 (SubSidebar 상담관리 탭 갱신)
      queryClient.invalidateQueries({ queryKey: ['consultations', tenantId, 'all'] });
    },
  });
}

/**
 * 상담기록 수정 Hook
 */
export function useUpdateConsultation() {
  const queryClient = useQueryClient();
  const context = getApiContext();
  const tenantId = context.tenantId;
  const { data: session } = useSession();

  return useMutation({
    mutationFn: async ({
      consultationId,
      consultation,
      studentId,
    }: {
      consultationId: string;
      consultation: Partial<StudentConsultation>;
      studentId: string;
    }) => {
      const startTime = Date.now();
      const response = await apiClient.patch('student_consultations', consultationId, consultation);

      if (response.error) {
        throw new Error(response.error.message);
      }

      // Execution Audit 기록 생성 (액티비티.md 3.3, 12 참조)
      if (session?.user?.id) {
        const durationMs = Date.now() - startTime;
        const changedFields = Object.keys(consultation);
        await createExecutionAuditRecord(
          {
            operation_type: 'consultation.update',
            status: 'success',
            summary: `상담기록 수정 완료 (${changedFields.join(', ')})`,
            details: {
              consultation_id: consultationId,
              student_id: studentId,
              changed_fields: changedFields,
            },
            reference: {
              entity_type: 'consultation',
              entity_id: consultationId,
            },
            duration_ms: durationMs,
          },
          session.user.id
        );
      }

      return response.data!;
    },
    onSuccess: (_, variables) => {
      // 특정 학생의 상담 캐시 무효화
      queryClient.invalidateQueries({ queryKey: ['consultations', tenantId, variables.studentId] });
      // [캐시 동기화] 전체 상담 캐시도 무효화 (SubSidebar 상담관리 탭 갱신)
      queryClient.invalidateQueries({ queryKey: ['consultations', tenantId, 'all'] });
    },
  });
}

/**
 * 상담기록 삭제 Hook
 */
export function useDeleteConsultation() {
  const queryClient = useQueryClient();
  const context = getApiContext();
  const tenantId = context.tenantId;
  const { data: session } = useSession();

  return useMutation({
    mutationFn: async ({
      consultationId,
      studentId,
    }: {
      consultationId: string;
      studentId: string;
    }) => {
      const startTime = Date.now();
      const response = await apiClient.delete('student_consultations', consultationId);

      if (response.error) {
        throw new Error(response.error.message);
      }

      // Execution Audit 기록 생성 (액티비티.md 3.3, 12 참조)
      if (session?.user?.id) {
        const durationMs = Date.now() - startTime;
        await createExecutionAuditRecord(
          {
            operation_type: 'consultation.delete',
            status: 'success',
            summary: `상담기록 삭제 완료`,
            details: {
              consultation_id: consultationId,
              student_id: studentId,
            },
            reference: {
              entity_type: 'consultation',
              entity_id: consultationId,
            },
            duration_ms: durationMs,
          },
          session.user.id
        );
      }
    },
    onSuccess: (_, variables) => {
      // 특정 학생의 상담 캐시 무효화
      queryClient.invalidateQueries({ queryKey: ['consultations', tenantId, variables.studentId] });
      // [캐시 동기화] 전체 상담 캐시도 무효화 (SubSidebar 상담관리 탭 갱신)
      queryClient.invalidateQueries({ queryKey: ['consultations', tenantId, 'all'] });
    },
  });
}

/**
 * 서버가 상담기록 AI 요약 생성하는 Hook
 * [요구사항] 상담기록 AI 요약 버튼 추가
 *
 * [불변 규칙] Edge Function을 통해 서버가 AI 요약 생성
 * [불변 규칙] Zero-Trust: JWT는 사용자 세션에서 가져옴
 */
export function useGenerateConsultationAISummary() {
  const queryClient = useQueryClient();
  const context = getApiContext();
  const tenantId = context.tenantId;

  return useMutation({
    mutationFn: async ({
      consultationId,
      studentId,
    }: {
      consultationId: string;
      studentId: string;
    }) => {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      // [불변 규칙] Zero-Trust: @api-sdk/core를 통해서만 Edge Function 호출
      // apiClient.invokeFunction()은 자동으로 JWT 토큰을 포함하여 요청
      // Edge Function은 JWT에서 tenant_id를 추출합니다 (요청 본문에서 받지 않음)
      const response = await apiClient.invokeFunction<{ ai_summary: string }>(
        'consultation-ai-summary',
        {
          consultation_id: consultationId,
        }
      );

      if (response.error) {
        throw new Error(response.error.message || 'AI 요약 생성에 실패했습니다.');
      }

      if (!response.data?.ai_summary) {
        throw new Error('AI 요약 데이터가 없습니다.');
      }

      return response.data.ai_summary;
    },
    onSuccess: (_, variables) => {
      // 특정 학생의 상담 캐시 무효화 (AI 요약 반영)
      queryClient.invalidateQueries({ queryKey: ['consultations', tenantId, variables.studentId] });
      // [캐시 동기화] 전체 상담 캐시도 무효화 (SubSidebar 상담관리 탭 갱신)
      queryClient.invalidateQueries({ queryKey: ['consultations', tenantId, 'all'] });
    },
  });
}

/**
 * 보호자 생성 Hook
 */
export function useCreateGuardian() {
  const queryClient = useQueryClient();
  const context = getApiContext();
  const tenantId = context.tenantId;
  const { data: session } = useSession();

  return useMutation({
    mutationFn: async ({
      studentId,
      guardian,
    }: {
      studentId: string;
      guardian: Omit<Guardian, 'id' | 'tenant_id' | 'student_id' | 'created_at' | 'updated_at'>;
    }) => {
      const startTime = Date.now();
      console.group('[useCreateGuardian] 학부모 생성 디버깅');
      console.log('입력 데이터:', {
        studentId,
        guardian,
        contextTenantId: tenantId,
        contextIndustryType: context.industryType,
      });

      const payload = {
        student_id: studentId,
        ...guardian,
      };
      // [P2-FIX] 이모지 제거 - 코드 내 이모지 사용 금지
      console.log('[Payload] 전송 Payload (tenant_id 주입 전):', payload);

      const response = await apiClient.post<Guardian>('guardians', payload);

      console.log('[Response] API 응답:', {
        success: response.success,
        error: response.error,
        data: response.data,
      });

      if (response.error) {
        console.error('학부모 생성 실패:', response.error);
        console.groupEnd();
        throw new Error(response.error.message);
      }

      console.log('학부모 생성 성공!');
      console.log('   생성된 guardian ID:', response.data?.id);
      console.log('   tenant_id:', response.data?.tenant_id);
      console.log('   student_id:', response.data?.student_id);
      console.groupEnd();

      // Execution Audit 기록 생성 (액티비티.md 3.3, 12 참조)
      if (session?.user?.id && response.data) {
        const durationMs = Date.now() - startTime;
        await createExecutionAuditRecord(
          {
            operation_type: 'guardian.register',
            status: 'success',
            summary: `${guardian.name || '보호자'} 등록 완료`,
            details: {
              guardian_id: response.data.id,
              student_id: studentId,
            },
            reference: {
              entity_type: 'guardian',
              entity_id: response.data.id,
            },
            duration_ms: durationMs,
          },
          session.user.id
        );
      }

      return response.data!;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['guardians', tenantId, variables.studentId] });
    },
  });
}

/**
 * 보호자 수정 Hook
 */
export function useUpdateGuardian() {
  const queryClient = useQueryClient();
  const context = getApiContext();
  const tenantId = context.tenantId;
  const { data: session } = useSession();

  return useMutation({
    mutationFn: async ({
      guardianId,
      guardian,
      studentId,
    }: {
      guardianId: string;
      guardian: Partial<Guardian>;
      studentId: string;
    }) => {
      const startTime = Date.now();
      const response = await apiClient.patch('guardians', guardianId, guardian);

      if (response.error) {
        throw new Error(response.error.message);
      }

      // Execution Audit 기록 생성 (액티비티.md 3.3, 12 참조)
      if (session?.user?.id && response.data) {
        const durationMs = Date.now() - startTime;
        const changedFields = Object.keys(guardian);
        await createExecutionAuditRecord(
          {
            operation_type: 'guardian.update',
            status: 'success',
            summary: `보호자 정보 수정 완료 (${changedFields.join(', ')})`,
            details: {
              guardian_id: guardianId,
              student_id: studentId,
              changed_fields: changedFields,
            },
            reference: {
              entity_type: 'guardian',
              entity_id: guardianId,
            },
            duration_ms: durationMs,
          },
          session.user.id
        );
      }

      return response.data!;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['guardians', tenantId, variables.studentId] });
    },
  });
}

/**
 * 보호자 삭제 Hook
 */
export function useDeleteGuardian() {
  const queryClient = useQueryClient();
  const context = getApiContext();
  const tenantId = context.tenantId;
  const { data: session } = useSession();

  return useMutation({
    mutationFn: async ({
      guardianId,
      studentId,
    }: {
      guardianId: string;
      studentId: string;
    }) => {
      const startTime = Date.now();
      const response = await apiClient.delete('guardians', guardianId);

      if (response.error) {
        throw new Error(response.error.message);
      }

      // Execution Audit 기록 생성 (액티비티.md 3.3, 12 참조)
      if (session?.user?.id) {
        const durationMs = Date.now() - startTime;
        await createExecutionAuditRecord(
          {
            operation_type: 'guardian.delete',
            status: 'success',
            summary: `보호자 삭제 완료`,
            details: {
              guardian_id: guardianId,
              student_id: studentId,
            },
            reference: {
              entity_type: 'guardian',
              entity_id: guardianId,
            },
            duration_ms: durationMs,
          },
          session.user.id
        );
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['guardians', tenantId, variables.studentId] });
    },
  });
}

/**
 * 학생 태그 업데이트 Hook
 */
export function useUpdateStudentTags() {
  const queryClient = useQueryClient();
  const context = getApiContext();
  const tenantId = context.tenantId;
  const { data: session } = useSession();

  return useMutation({
    mutationFn: async ({
      studentId,
      tagIds,
    }: {
      studentId: string;
      tagIds: string[];
    }) => {
      const startTime = Date.now();

      // [N+1 최적화] 기존 태그 할당 조회
      const existingTags = await apiClient.get<TagAssignment>('tag_assignments', {
        filters: { entity_id: studentId, entity_type: 'student' },
      });

      // [N+1 최적화] 기존 태그 삭제를 병렬로 처리
      if (existingTags.data && existingTags.data.length > 0) {
        await Promise.all(
          existingTags.data.map((assignment) =>
            apiClient.delete('tag_assignments', assignment.id)
          )
        );
      }

      // [N+1 최적화] 새 태그 할당을 병렬로 처리
      if (tagIds.length > 0) {
        await Promise.all(
          tagIds.map((tagId) =>
            apiClient.post('tag_assignments', {
              entity_id: studentId,
              entity_type: 'student',
              tag_id: tagId,
            })
          )
        );
      }

      // Execution Audit 기록 생성 (액티비티.md 3.3, 12 참조)
      if (session?.user?.id) {
        const durationMs = Date.now() - startTime;
        await createExecutionAuditRecord(
          {
            operation_type: 'student.update-tags',
            status: 'success',
            summary: `학생 태그 업데이트 완료 (${tagIds.length}개 태그)`,
            details: {
              student_id: studentId,
              tag_count: tagIds.length,
            },
            reference: {
              entity_type: 'student',
              entity_id: studentId,
            },
            duration_ms: durationMs,
          },
          session.user.id
        );
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tags', tenantId, 'student', variables.studentId] });
      queryClient.invalidateQueries({ queryKey: ['students', tenantId] });
    },
  });
}

// ==================== 학생 수업 배정 관리 ====================

/**
 * 모든 학생의 수업 배정 정보 조회 Hook
 * [요구사항] 수업배정 탭에서 전체 학생별 수업 배정 현황 표시
 */
export function useAllStudentClasses() {
  const context = getApiContext();
  const tenantId = context.tenantId;

  return useQuery({
    queryKey: ['all-student-classes', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];

      // 모든 활성 학생-수업 배정 조회
      const response = await apiClient.get<StudentClass>('student_classes', {
        filters: { is_active: true },
        limit: 10000,
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      // 학생별로 그룹화
      const studentClassMap = new Map<string, string[]>();
      (response.data || []).forEach((sc: StudentClass) => {
        const existing = studentClassMap.get(sc.student_id) || [];
        existing.push(sc.class_id);
        studentClassMap.set(sc.student_id, existing);
      });

      // 배열로 변환
      return Array.from(studentClassMap.entries()).map(([student_id, class_ids]) => ({
        student_id,
        class_ids,
      }));
    },
    enabled: !!tenantId,
  });
}

/**
 * 학생의 수업 목록 조회 Hook
 * [요구사항] 수강 중인 수업 지속 지원
 * [수정] PostgREST 조인 문법 오류 수정: 두 번의 쿼리로 분리
 */
export function useStudentClasses(studentId: string | null) {
  const context = getApiContext();
  const tenantId = context.tenantId;

  return useQuery({
    queryKey: ['student-classes', tenantId, studentId],
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    queryFn: async () => {
      if (!studentId) return [];

      // 1. student_classes 조회
      const studentClassesResponse = await apiClient.get<StudentClass>('student_classes', {
        filters: { student_id: studentId, is_active: true },
        orderBy: { column: 'enrolled_at', ascending: false },
      });

      if (studentClassesResponse.error) {
        throw new Error(studentClassesResponse.error.message);
      }

      const studentClasses = studentClassesResponse.data || [];
      if (studentClasses.length === 0) return [];

      // 2. class_id 배열 추출
      const classIds = studentClasses.map((sc: StudentClass) => sc.class_id);

      // 3. academy_classes 조회
      const classesResponse = await apiClient.get<Class>('academy_classes', {
        filters: { id: classIds },
      });

      if (classesResponse.error) {
        throw new Error(classesResponse.error.message);
      }

      const classes = classesResponse.data || [];
      const classMap = new Map(classes.map((c) => [c.id, c]));

      // 4. 조합하여 반환
      return studentClasses.map((sc: StudentClass) => ({
        ...sc,
        class: classMap.get(sc.class_id) || null,
      }));
    },
    enabled: !!tenantId && !!studentId,
  });
}

/**
 * 학생 반 배정 Hook
 * [요구사항] 반 배정, 수강 중인 반 지속 지원
 * [수정] current_count 자동 업데이트 제거 (Service Layer에서 처리하도록 변경 필요)
 * [주의] 현재는 apiClient를 통해 직접 호출하나, 향후 Edge Function으로 이동 권장
 */
export function useAssignStudentToClass() {
  const queryClient = useQueryClient();
  const context = getApiContext();
  const tenantId = context.tenantId;
  const { data: session } = useSession();

  return useMutation({
    mutationFn: async ({
      studentId,
      classId,
      enrolledAt,
    }: {
      studentId: string;
      classId: string;
      enrolledAt?: string;
    }) => {
      const startTime = Date.now();
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      // student_classes에 배정
      // [주의] current_count 업데이트는 Industry Service의 enrollStudentToClass에서 처리해야 함
      // 현재는 apiClient를 통해 직접 호출하나, 향후 Edge Function으로 이동 권장
      const enrolledDate = enrolledAt || toKST().format('YYYY-MM-DD');

      // [성능 최적화] INSERT-first 패턴: 대부분의 경우 새 레코드이므로 INSERT를 먼저 시도
      // 409 Conflict (duplicate key) 오류가 발생하면 UPDATE로 처리
      // 이 방식이 기존 레코드를 먼저 조회하는 방식보다 효율적 (네트워크 요청 1회 감소)
      let response = await apiClient.post<StudentClass>('student_classes', {
        student_id: studentId,
        class_id: classId,
        // 기술문서 5-2: KST 기준 날짜 처리
        enrolled_at: enrolledDate,
        is_active: true,
      });

      // [불변 규칙] 중복 키 오류 처리: unique constraint 위반 시 UPDATE로 전환
      // unique constraint: student_classes_student_id_class_id_enrolled_at_key
      // PostgreSQL 에러 코드: 23505 (unique_violation)
      // [안정성] 에러 코드와 메시지 모두 체크하여 중복 키 오류를 정확히 감지
      const originalErrorMessage = response.error?.message;
      const isDuplicateKeyError = response.error && (
        response.error.code === '23505' ||
        response.error.message?.includes('duplicate key') ||
        response.error.message?.includes('unique constraint')
      );

      if (isDuplicateKeyError) {
        // 중복 키 오류 발생: 기존 레코드를 조회하여 UPDATE
        const existingResponse = await apiClient.get<StudentClass>('student_classes', {
          filters: {
            student_id: studentId,
            class_id: classId,
            enrolled_at: enrolledDate
          },
          limit: 1,
        });

        // [안정성] 에러 처리: 기존 레코드 조회 실패 시 원본 오류를 유지
        if (existingResponse.error || !existingResponse.data || existingResponse.data.length === 0) {
          throw new Error(originalErrorMessage || 'Failed to find existing record for update');
        }

        const existing = existingResponse.data[0];
        response = await apiClient.patch<StudentClass>('student_classes', existing.id, {
          is_active: true,
          // left_at이 있으면 제거 (재등록)
          left_at: null,
        });
      }

      // [안정성] 타입 안정성: response.data가 undefined인 경우 명시적 에러 처리
      if (response.error) {
        throw new Error(response.error.message);
      }

      if (!response.data) {
        throw new Error('Failed to assign student to class: No data returned');
      }

      // [수정] current_count 자동 업데이트 제거
      // current_count는 Industry Service의 enrollStudentToClass 메서드에서 처리하거나
      // PostgreSQL 트리거로 자동 업데이트되어야 함
      // TODO: Edge Function을 통해 enrollStudentToClass 호출로 변경

      // Execution Audit 기록 생성 (액티비티.md 3.3, 12 참조)
      if (session?.user?.id && response.data) {
        const durationMs = Date.now() - startTime;
        await createExecutionAuditRecord(
          {
            operation_type: 'student.assign-class',
            status: 'success',
            summary: `학생 반 배정 완료 (class_id: ${classId})`,
            details: {
              student_id: studentId,
              class_id: classId,
            },
            reference: {
              entity_type: 'student',
              entity_id: studentId,
            },
            duration_ms: durationMs,
          },
          session.user.id
        );
      }

      return response.data;
    },
    onSuccess: (_, variables) => {
      // [성능 최적화] 캐시 무효화를 배치로 처리 (React Query v5 최적화)
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey;
          return (
            (key[0] === 'student-classes' && key[1] === tenantId && key[2] === variables.studentId) ||
            (key[0] === 'all-student-classes' && key[1] === tenantId) ||
            (key[0] === 'classes' && key[1] === tenantId) ||
            (key[0] === 'students' && key[1] === tenantId)
          );
        }
      });
    },
  });
}

/**
 * 학생 반 이동/제거 Hook
 * [요구사항] 반 이동, 수강 중인 반 지속 지원
 * [수정] current_count 자동 업데이트 제거 (Service Layer에서 처리하도록 변경 필요)
 * [주의] 현재는 apiClient를 통해 직접 호출하나, 향후 Edge Function으로 이동 권장
 */
export function useUnassignStudentFromClass() {
  const queryClient = useQueryClient();
  const context = getApiContext();
  const tenantId = context.tenantId;
  const { data: session } = useSession();

  return useMutation({
    mutationFn: async ({
      studentId,
      classId,
      leftAt,
    }: {
      studentId: string;
      classId: string;
      leftAt?: string;
    }) => {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const startTime = Date.now();

      // student_classes에서 해당 배정 찾기
      const findResponse = await apiClient.get<StudentClass>('student_classes', {
        filters: { student_id: studentId, class_id: classId, is_active: true },
        limit: 1,
      });

      if (findResponse.error || !findResponse.data?.[0]) {
        throw new Error('Student class assignment not found');
      }

      const assignment = findResponse.data[0];

      // is_active를 false로 변경하고 left_at 설정
      // [주의] current_count 업데이트는 Industry Service의 unenrollStudentFromClass에서 처리해야 함
      // 현재는 apiClient를 통해 직접 호출하나, 향후 Edge Function으로 이동 권장
      const response = await apiClient.patch('student_classes', assignment.id, {
        is_active: false,
        // 기술문서 5-2: KST 기준 날짜 처리
        left_at: leftAt || toKST().format('YYYY-MM-DD'),
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      // [안정성] 타입 안정성: response.data가 undefined인 경우 명시적 에러 처리
      if (!response.data) {
        throw new Error('Failed to unassign student from class: No data returned');
      }

      // [수정] current_count 자동 업데이트 제거
      // current_count는 Industry Service의 unenrollStudentFromClass 메서드에서 처리하거나
      // PostgreSQL 트리거로 자동 업데이트되어야 함
      // TODO: Edge Function을 통해 unenrollStudentFromClass 호출로 변경

      // Execution Audit 기록 생성 (액티비티.md 3.3, 12 참조)
      if (session?.user?.id) {
        const durationMs = Date.now() - startTime;
        await createExecutionAuditRecord(
          {
            operation_type: 'student.unassign-class',
            status: 'success',
            summary: `학생 반 배정 제거 완료 (class_id: ${classId})`,
            details: {
              student_id: studentId,
              class_id: classId,
            },
            reference: {
              entity_type: 'student',
              entity_id: studentId,
            },
            duration_ms: durationMs,
          },
          session.user.id
        );
      }

      return response.data;
    },
    onSuccess: (_, variables) => {
      // [성능 최적화] 캐시 무효화를 배치로 처리 (React Query v5 최적화)
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey;
          return (
            (key[0] === 'student-classes' && key[1] === tenantId && key[2] === variables.studentId) ||
            (key[0] === 'all-student-classes' && key[1] === tenantId) ||
            (key[0] === 'classes' && key[1] === tenantId) ||
            (key[0] === 'students' && key[1] === tenantId)
          );
        }
      });
    },
  });
}

/**
 * 학생 반 배정일(enrolled_at) 업데이트 Hook
 * [P0-2] App Layer 분리 원칙 준수: UI에서 직접 apiClient.patch 호출 제거
 * [요구사항] 같은 반일 때 enrolled_at만 업데이트
 * [주의] 현재는 apiClient를 통해 직접 호출하나, 향후 Edge Function으로 이동 권장
 */
export function useUpdateStudentClassEnrolledAt() {
  const queryClient = useQueryClient();
  const context = getApiContext();
  const tenantId = context.tenantId;
  const { data: session } = useSession();

  return useMutation({
    mutationFn: async ({
      studentClassId,
      enrolledAt,
    }: {
      studentClassId: string;
      enrolledAt: string;
    }) => {
      const startTime = Date.now();
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      // student_classes의 enrolled_at만 업데이트
      // [주의] current_count 업데이트는 필요 없음 (같은 수업이므로 학생 수 변화 없음)
      const response = await apiClient.patch<StudentClass>('student_classes', studentClassId, {
        // 기술문서 5-2: KST 기준 날짜 처리
        enrolled_at: enrolledAt,
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      if (!response.data) {
        throw new Error('Failed to update student class enrolled_at: No data returned');
      }

      // Execution Audit 기록 생성 (액티비티.md 3.3, 12 참조)
      if (session?.user?.id) {
        const durationMs = Date.now() - startTime;
        await createExecutionAuditRecord(
          {
            operation_type: 'student.update-class-enrolled-at',
            status: 'success',
            summary: `학생 반 등록일 수정 완료`,
            details: {
              student_class_id: studentClassId,
              new_enrolled_at: enrolledAt,
            },
            reference: {
              entity_type: 'student_class',
              entity_id: studentClassId,
            },
            duration_ms: durationMs,
          },
          session.user.id
        );
      }

      return response.data;
    },
    onSuccess: (data) => {
      // [성능 최적화] 캐시 무효화를 배치로 처리 (React Query v5 최적화)
      // studentClassId로 student_id를 찾을 수 없으므로, 모든 student-classes 쿼리 무효화
      queryClient.invalidateQueries({ queryKey: ['student-classes', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['students', tenantId] });
    },
  });
}
