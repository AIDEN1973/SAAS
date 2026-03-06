/**
 * 수업 담당강사 탭 컴포넌트
 *
 * [LAYER: UI_PAGE]
 */

import { Card } from '@ui-core/react';
import { useIndustryTerms } from '@hooks/use-industry-terms';
import type { Teacher } from '@services/class-service';

interface ClassTeachersTabProps {
  classTeachers: Array<{ id: string; teacher_id: string; class_id: string }>;
  isLoading: boolean;
  allTeachers: Teacher[];
}

export function ClassTeachersTab({
  classTeachers,
  isLoading,
  allTeachers,
}: ClassTeachersTabProps) {
  const terms = useIndustryTerms();

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)', color: 'var(--color-text-secondary)' }}>
        로딩 중...
      </div>
    );
  }

  if (!classTeachers || classTeachers.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)', color: 'var(--color-text-secondary)' }}>
        담당 {terms.PERSON_LABEL_SECONDARY}가 없습니다.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
      {classTeachers.map((ct) => {
        // [수정 2026-01-27] ct.teacher_id는 academy_teachers.id를 참조
        const teacher = allTeachers.find(t => t.id === ct.teacher_id);
        return (
          <Card key={ct.id} padding="sm">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 'var(--font-weight-semibold)' }}>
                  {teacher?.name || '알 수 없음'}
                </div>
                {teacher?.specialization && (
                  <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                    {teacher.specialization}
                  </div>
                )}
              </div>
              {teacher?.phone && (
                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                  {teacher.phone}
                </div>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
