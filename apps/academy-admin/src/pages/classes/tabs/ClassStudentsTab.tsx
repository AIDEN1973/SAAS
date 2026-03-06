/**
 * 수업 수강생 탭 컴포넌트
 *
 * [LAYER: UI_PAGE]
 */

import { useMemo } from 'react';
import { Card } from '@ui-core/react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@api-sdk/core';
import { useIndustryTerms } from '@hooks/use-industry-terms';
import { toKST } from '@lib/date-utils';

export function ClassStudentsTab({ classId }: { classId: string }) {
  const terms = useIndustryTerms();
  // [예외] classId 기반 student_classes 조회는 아직 hook이 없어 직접 조회
  const { data: studentClasses, isLoading } = useQuery({
    queryKey: ['student_classes', 'by_class', classId],
    queryFn: async () => {
      // eslint-disable-next-line no-restricted-syntax -- batch query by classId not supported by hook
      const response = await apiClient.get<{ id: string; student_id: string; class_id: string; is_active: boolean; enrolled_at: string | null; left_at: string | null }>('student_classes', {
        filters: { class_id: classId, is_active: true },
        limit: 100,
      });
      if (response.error) throw new Error(response.error.message);
      return response.data || [];
    },
    enabled: !!classId,
  });

  // 학생 정보 조회 — .in() 배치 쿼리로 N+1 제거
  const studentIds = useMemo(() => studentClasses?.map(sc => sc.student_id) || [], [studentClasses]);
  const { data: students, isLoading: studentsLoading } = useQuery({
    queryKey: ['persons', 'bulk', classId, studentIds.length],
    queryFn: async () => {
      if (studentIds.length === 0) return [];

      const response = await apiClient.get<{ id: string; name: string; phone?: string }>('persons', {
        filters: { id: studentIds },
        limit: studentIds.length,
      });

      if (response.error) {
        console.warn(`Failed to fetch students for class ${classId}:`, response.error.message);
        return [];
      }

      return response.data || [];
    },
    enabled: studentIds.length > 0,
  });

  if (isLoading || studentsLoading) {
    return (
      <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)', color: 'var(--color-text-secondary)' }}>
        로딩 중...
      </div>
    );
  }

  if (!studentClasses || studentClasses.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)', color: 'var(--color-text-secondary)' }}>
        배정된 {terms.PERSON_LABEL_PRIMARY}이 없습니다.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
      {studentClasses.map((sc) => {
        const student = students?.find(s => s.id === sc.student_id);
        return (
          <Card key={sc.id} padding="sm">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 'var(--font-weight-semibold)' }}>
                  {student?.name || '알 수 없음'}
                </div>
                {student?.phone && (
                  <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                    {student.phone}
                  </div>
                )}
              </div>
              {sc.enrolled_at && (
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                  {toKST(sc.enrolled_at).format('YYYY-MM-DD')} 등록
                </div>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
