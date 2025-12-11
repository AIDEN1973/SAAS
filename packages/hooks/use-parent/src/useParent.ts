/**
 * useParent Hook
 *
 * React Query 기반 학부모 앱 Hook
 * [불변 규칙] tenant 변경 시 invalidateQueries() 자동 발생
 * [불변 규칙] api-sdk를 통해서만 데이터 요청
 */

import { useQuery } from '@tanstack/react-query';
import { apiClient, getApiContext } from '@api-sdk/core';
import type { Student } from '@services/student-service';

/**
 * 자녀 목록 조회 Hook
 * [불변 규칙] Zero-Trust: tenantId는 Context에서 자동으로 가져옴
 * 학부모는 자신이 보호자인 학생만 조회 가능 (RLS 정책)
 */
export function useChildren() {
  const context = getApiContext();
  const tenantId = context.tenantId;

  return useQuery({
    queryKey: ['children', tenantId],
    queryFn: async () => {
      // RLS 정책에 의해 현재 사용자가 보호자인 학생만 조회됨
      // guardians 테이블을 통해 자녀를 조회
      const guardiansResponse = await apiClient.get<any>('guardians', {
        filters: {},
        orderBy: { column: 'is_primary', ascending: false },
      });

      if (guardiansResponse.error) {
        throw new Error(guardiansResponse.error.message);
      }

      const guardians = guardiansResponse.data || [];
      if (guardians.length === 0) {
        return [];
      }

      // student_id 목록 추출
      const studentIds = [...new Set(guardians.map((g: any) => g.student_id))];

      // persons + academy_students 조인하여 학생 정보 조회
      const studentsResponse = await apiClient.get<any>('persons', {
        select: `
          id,
          tenant_id,
          name,
          phone,
          email,
          address,
          academy_students (
            birth_date,
            gender,
            school_name,
            grade,
            status,
            notes
          )
        `,
        filters: {
          id: { in: studentIds },
          person_type: 'student'
        },
      });

      if (studentsResponse.error) {
        throw new Error(studentsResponse.error.message);
      }

      // 데이터 변환 persons + academy_students -> Student
      const personsData = studentsResponse.data || [];
      const children: Student[] = personsData.map((person: any) => {
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
        } as Student;
      });

      return children;
    },
    enabled: !!tenantId,
  });
}

