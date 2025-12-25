/**
 * useStudent Hook
 *
 * React Query 기반 학생 관리 Hook
 * [불변 규칙] tenant 변경 시 invalidateQueries() 자동 발생
 * [불변 규칙] api-sdk를 통해서만 데이터 요청
 */

import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, getApiContext } from '@api-sdk/core';
import type { ApiResponse } from '@api-sdk/core';
import { toKST } from '@lib/date-utils'; // 기술문서 5-2: KST 변환 필수
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
      if (filter?.status || filter?.grade) {
        interface AcademyStudentIdRow {
          person_id: string;
        }
        const academyFilters: Record<string, unknown> = {};
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
      if (filter?.class_id) {
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
      const response = await apiClient.get<PersonWithAcademyStudents>('persons', {
        select: `
          *,
          academy_students (
            birth_date,
            gender,
            school_name,
            grade,
            class_name,
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

      // 학부모 정보 조회 (주 보호자만)
      const guardiansResponse = await apiClient.get<Guardian>('guardians', {
        filters: { student_id: studentIds, is_primary: true },
      });
      const guardiansMap = new Map();
      if (!guardiansResponse.error && guardiansResponse.data) {
        guardiansResponse.data.forEach((g: Guardian) => {
          if (!guardiansMap.has(g.student_id)) {
            guardiansMap.set(g.student_id, g.name);
          }
        });
      }

      // 대표반 정보 조회 (활성 반 중 첫 번째)
      const studentClassesResponse = await apiClient.get<StudentClass>('student_classes', {
        filters: { student_id: studentIds, is_active: true },
      });
      const studentClassMap = new Map();
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
                studentClassMap.set(sc.student_id, classMap.get(sc.class_id));
              }
            });
          }
        }
      }

      // 데이터 변환 persons + academy_students -> Student
      let students: Student[] = personsData.map((person: Person & { academy_students?: Array<Record<string, unknown>> }) => {
        const academyData = person.academy_students?.[0] || {};
        return {
          id: person.id,
          tenant_id: person.tenant_id,
          industry_type: 'academy',
          name: person.name,
          birth_date: academyData.birth_date,
          gender: academyData.gender,
          phone: person.phone,
          email: person.email,
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

  return (response.data || []) as Person[];
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
        const academyFilters: Record<string, unknown> = {};
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
      if (filter?.class_id) {
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

      const students: Student[] = personsData.map((person: Person & { academy_students?: Array<Record<string, unknown>> }) => {
        const academyData = person.academy_students?.[0] || {};
        return {
          id: person.id,
          tenant_id: person.tenant_id,
          industry_type: 'academy',
          name: person.name,
          birth_date: academyData.birth_date,
          gender: academyData.gender,
          phone: person.phone,
          email: person.email,
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
    queryFn: async () => {
      if (!studentId) return null;

      // students View를 사용하여 조회 (persons + academy_students 조인)
      interface PersonWithAcademyStudents extends Person {
        academy_students?: Array<Record<string, unknown>>;
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
        email: person.email ?? undefined,
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

  return useMutation({
    mutationFn: async (input: CreateStudentInput) => {
      // 1. persons 테이블에 생성 (공통 필드)
      const personResponse = await apiClient.post<Person>('persons', {
        name: input.name,
        email: input.email,
        phone: input.phone,
        address: input.address,
        person_type: 'student',
      });

      if (personResponse.error) {
        throw new Error(personResponse.error.message);
      }

      const person = personResponse.data!;

      // 2. academy_students 테이블에 확장 정보 추가
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
      const academyResponse = await apiClient.post<AcademyStudent>('academy_students', {
        person_id: person.id,
        birth_date: input.birth_date,
        gender: input.gender,
        school_name: input.school_name,
        grade: input.grade,
        status: input.status || 'active',
        notes: input.notes,
        profile_image_url: input.profile_image_url,
      });

      if (academyResponse.error) {
        // 롤백: persons 삭제
        await apiClient.delete('persons', person.id);
        throw new Error(academyResponse.error.message);
      }

      // 3. 보호자 정보 생성
      if (input.guardians && input.guardians.length > 0) {
        for (const guardian of input.guardians) {
          await apiClient.post<Guardian>('guardians', {
            student_id: person.id,
            ...guardian,
          });
        }
      }

      // 4. 태그 연결
      if (input.tag_ids && input.tag_ids.length > 0) {
        for (const tagId of input.tag_ids) {
          await apiClient.post('tag_assignments', {
            entity_id: person.id,
            entity_type: 'student',
            tag_id: tagId,
          });
        }
      }

      // 5. 결과 반환 (persons + academy_students 조합)
      return {
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
      } as Student;
    },
    onSuccess: () => {
      // 학생 목록 쿼리 무효화
      queryClient.invalidateQueries({ queryKey: ['students', tenantId] });
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
      // [불변 규칙] api-sdk를 통해서만 데이터 요청
      // 일괄 등록은 여러 개의 POST 요청으로 처리
      const results: Student[] = [];
      const errors: Array<{ index: number; error: string }> = [];

      for (let i = 0; i < students.length; i++) {
        try {
          // 1. persons 테이블에 생성
          const personResponse = await apiClient.post<Person>('persons', {
            name: students[i].name,
            email: students[i].email,
            phone: students[i].phone,
            address: students[i].address,
            person_type: 'student',
          });

          if (personResponse.error) {
            throw new Error(personResponse.error.message);
          }

          const person = personResponse.data!;

          // 2. academy_students 테이블에 확장 정보 추가
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
          const academyResponse = await apiClient.post<AcademyStudent>('academy_students', {
            person_id: person.id,
            birth_date: students[i].birth_date,
            gender: students[i].gender,
            school_name: students[i].school_name,
            grade: students[i].grade,
            status: students[i].status || 'active',
            notes: students[i].notes,
            profile_image_url: students[i].profile_image_url,
          });

          if (academyResponse.error) {
            // 롤백: persons 삭제
            await apiClient.delete('persons', person.id);
            throw new Error(academyResponse.error.message);
          }

          // 3. 결과 반환
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
        } catch (error) {
          errors.push({
            index: i,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      if (errors.length > 0) {
        console.warn('일부 학생 등록 실패:', errors);
      }

      return { results, errors };
    },
    onSuccess: () => {
      // 학생 목록 쿼리 무효화
      queryClient.invalidateQueries({ queryKey: ['students', tenantId] });
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

  return useMutation({
    mutationFn: async ({
      studentId,
      input,
    }: {
      studentId: string;
      input: UpdateStudentInput;
    }) => {
      // 1. persons 테이블 업데이트 (공통 필드)
      const personUpdate: Partial<{ name?: string; email?: string; phone?: string; address?: string }> = {};
      if (input.name !== undefined) personUpdate.name = input.name;
      if (input.email !== undefined) personUpdate.email = input.email;
      if (input.phone !== undefined) personUpdate.phone = input.phone;
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
          status?: string;
          notes?: string;
          profile_image_url?: string;
          created_at: string;
          updated_at: string;
          created_by?: string;
          updated_by?: string;
        }
        const academyResponse = await apiClient.get<AcademyStudent>('academy_students', {
          filters: { person_id: studentId },
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

      const academyData = person.academy_students?.[0] || {};
      return {
        id: person.id,
        tenant_id: person.tenant_id,
        industry_type: 'academy',
        name: person.name,
        birth_date: academyData.birth_date,
        gender: academyData.gender,
        phone: person.phone,
        email: person.email,
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
    },
    onSuccess: (data) => {
      // 학생 목록 및 상세 쿼리 무효화
      // students-paged 쿼리도 무효화하여 테이블에 즉시 반영되도록 함
      queryClient.invalidateQueries({ queryKey: ['students', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['students-paged', tenantId] });
      queryClient.invalidateQueries({
        queryKey: ['student', tenantId, data.id],
      });
    },
  });
}

/**
 * 학생 삭제 Hook (Soft delete: status를 'withdrawn'으로 변경)
 * [불변 규칙] Zero-Trust: tenantId는 Context에서 자동으로 가져옴
 */
export function useDeleteStudent() {
  const queryClient = useQueryClient();
  const context = getApiContext();
  const tenantId = context.tenantId;

  return useMutation({
    mutationFn: async (studentId: string) => {
      // Soft delete: status를 'withdrawn'으로 변경
      // [불변 규칙] students는 View이므로 academy_students를 직접 업데이트해야 함
      interface AcademyStudent {
        person_id: string;
        tenant_id: string;
        status?: string;
      }

      const academyResponse = await apiClient.get<AcademyStudent>('academy_students', {
        filters: { person_id: studentId },
        limit: 1,
      });

      if (academyResponse.error) {
        throw new Error(academyResponse.error.message);
      }

      const academyStudent = academyResponse.data?.[0];
      if (!academyStudent) {
        throw new Error('Academy student not found');
      }

      const updateResponse = await apiClient.patch('academy_students', academyStudent.person_id, {
        status: 'withdrawn',
      });

      if (updateResponse.error) {
        throw new Error(updateResponse.error.message);
      }

      return;
    },
    onSuccess: () => {
      // 학생 목록 쿼리 무효화
      queryClient.invalidateQueries({ queryKey: ['students', tenantId] });
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

  return (response.data || []) as Guardian[];
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

  return (response.data || []) as StudentConsultation[];
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
  });
}

/**
 * 상담기록 생성 Hook
 */
export function useCreateConsultation() {
  const queryClient = useQueryClient();
  const context = getApiContext();
  const tenantId = context.tenantId;

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
      const response = await apiClient.post('student_consultations', {
        student_id: studentId,
        ...consultation,
        created_by: userId,
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      return response.data!;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['consultations', tenantId, variables.studentId] });
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
      const response = await apiClient.patch('student_consultations', consultationId, consultation);

      if (response.error) {
        throw new Error(response.error.message);
      }

      return response.data!;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['consultations', tenantId, variables.studentId] });
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

  return useMutation({
    mutationFn: async ({
      consultationId,
      studentId,
    }: {
      consultationId: string;
      studentId: string;
    }) => {
      const response = await apiClient.delete('student_consultations', consultationId);

      if (response.error) {
        throw new Error(response.error.message);
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['consultations', tenantId, variables.studentId] });
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
      // [불변 규칙] Edge Function 호출
      // StudentsPage.tsx의 student-risk-analysis 호출 패턴과 동일하게 구현
      const { createClient } = await import('@lib/supabase-client');
      const supabase = createClient();
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !sessionData.session) {
        throw new Error('인증이 필요합니다. 로그인해주세요.');
      }

      // Supabase URL 가져오기
      const { envClient } = await import('@env-registry/client');
      const supabaseUrl = envClient.NEXT_PUBLIC_SUPABASE_URL;
      if (!supabaseUrl) {
        throw new Error('Supabase 설정이 완료되지 않았습니다.');
      }

      // Edge Function 호출
      // [불변 규칙] Zero-Trust: JWT에서 tenant_id를 추출하므로 실제 사용자 세션의 JWT 토큰을 전달
      const response = await fetch(`${supabaseUrl}/functions/v1/consultation-ai-summary`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionData.session.access_token}`, // 사용자 JWT (tenant_id 포함)
        },
        body: JSON.stringify({
          consultation_id: consultationId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: '알 수 없는 오류가 발생했습니다.' }));
        throw new Error(errorData.error || `서버가 AI 요약 생성 실패: ${response.status}`);
      }

      const data = await response.json();
      return data.ai_summary;
    },
    onSuccess: (_, variables) => {
      // 상담기록 목록 쿼리 무효화하여 AI 요약 반영
      queryClient.invalidateQueries({ queryKey: ['consultations', tenantId, variables.studentId] });
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

  return useMutation({
    mutationFn: async ({
      studentId,
      guardian,
    }: {
      studentId: string;
      guardian: Omit<Guardian, 'id' | 'tenant_id' | 'student_id' | 'created_at' | 'updated_at'>;
    }) => {
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
      console.log('📤 전송 Payload (tenant_id 주입 전):', payload);

      const response = await apiClient.post<Guardian>('guardians', payload);

      console.log('📥 API 응답:', {
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
      const response = await apiClient.patch('guardians', guardianId, guardian);

      if (response.error) {
        throw new Error(response.error.message);
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

  return useMutation({
    mutationFn: async ({
      guardianId,
      studentId,
    }: {
      guardianId: string;
      studentId: string;
    }) => {
      const response = await apiClient.delete('guardians', guardianId);

      if (response.error) {
        throw new Error(response.error.message);
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

  return useMutation({
    mutationFn: async ({
      studentId,
      tagIds,
    }: {
      studentId: string;
      tagIds: string[];
    }) => {
      // 기존 태그 할당 제거
      const existingTags = await apiClient.get<TagAssignment>('tag_assignments', {
        filters: { entity_id: studentId, entity_type: 'student' },
      });

      if (existingTags.data) {
        for (const assignment of existingTags.data) {
          await apiClient.delete('tag_assignments', assignment.id);
        }
      }

      // 새 태그 할당
      if (tagIds.length > 0) {
        for (const tagId of tagIds) {
          await apiClient.post('tag_assignments', {
            entity_id: studentId,
            entity_type: 'student',
            tag_id: tagId,
          });
        }
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tags', tenantId, 'student', variables.studentId] });
      queryClient.invalidateQueries({ queryKey: ['students', tenantId] });
    },
  });
}

// ==================== 학생 반 배정 관리 ====================

/**
 * 학생의 반 목록 조회 Hook
 * [요구사항] 수강 중인 반 지속 지원
 * [수정] PostgREST 조인 문법 오류 수정: 두 번의 쿼리로 분리
 */
export function useStudentClasses(studentId: string | null) {
  const context = getApiContext();
  const tenantId = context.tenantId;

  return useQuery({
    queryKey: ['student-classes', tenantId, studentId],
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

      return response.data;
    },
    onSuccess: (_, variables) => {
      // [성능 최적화] 캐시 무효화를 배치로 처리 (React Query v5 최적화)
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey;
          return (
            (key[0] === 'student-classes' && key[1] === tenantId && key[2] === variables.studentId) ||
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

      return response.data;
    },
    onSuccess: (_, variables) => {
      // [성능 최적화] 캐시 무효화를 배치로 처리 (React Query v5 최적화)
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey;
          return (
            (key[0] === 'student-classes' && key[1] === tenantId && key[2] === variables.studentId) ||
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

  return useMutation({
    mutationFn: async ({
      studentClassId,
      enrolledAt,
    }: {
      studentClassId: string;
      enrolledAt: string;
    }) => {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      // student_classes의 enrolled_at만 업데이트
      // [주의] current_count 업데이트는 필요 없음 (같은 반이므로 학생 수 변화 없음)
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
