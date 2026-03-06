/**
 * 수업 기본정보 탭 컴포넌트
 *
 * [LAYER: UI_PAGE]
 */

import { useMemo, useCallback } from 'react';
import { Card, useResponsiveMode, isMobile, IconButtonGroup } from '@ui-core/react';
import { Trash2, Pencil } from 'lucide-react';
import { SchemaForm } from '@schema-engine';
import { useIndustryTerms } from '@hooks/use-industry-terms';
import { DAYS_OF_WEEK } from '../constants';
import type { Class, ClassTeacher, Teacher, UpdateClassInput, ClassStatus, DayOfWeek } from '@services/class-service';
import type { FormSchema } from '@schema-engine/types';

interface ClassInfoTabProps {
  classData: Class;
  classTeachers: ClassTeacher[];
  teachers: Teacher[];
  isEditing: boolean;
  effectiveFormSchema: FormSchema;
  onEdit: () => void;
  onDelete: () => void;
  onCancel: () => void;
  onSave: (classId: string, input: UpdateClassInput) => Promise<void>;
}

export function ClassInfoTab({
  classData,
  classTeachers,
  teachers,
  isEditing,
  effectiveFormSchema,
  onEdit,
  onDelete,
  onCancel,
  onSave,
}: ClassInfoTabProps) {
  const terms = useIndustryTerms();
  const mode = useResponsiveMode();
  const modeUpper = mode.toUpperCase() as 'XS' | 'SM' | 'MD' | 'LG' | 'XL';
  const isMobileMode = isMobile(modeUpper);
  const dayLabel = Array.isArray(classData.day_of_week)
    ? classData.day_of_week.map(d => DAYS_OF_WEEK.find((day) => day.value === d)?.label || d).join(', ')
    : DAYS_OF_WEEK.find((d) => d.value === classData.day_of_week)?.label || classData.day_of_week;

  const gradeLabel = Array.isArray(classData.grade)
    ? classData.grade.join(', ')
    : classData.grade || '-';

  // 담당 선생님 라벨 생성
  const teacherLabel = useMemo(() => {
    if (!classTeachers || classTeachers.length === 0) return '-';

    const teacherNames = classTeachers.map(ct => {
      // [수정 2026-01-27] ct.teacher_id는 academy_teachers.id를 참조
      const teacher = teachers?.find(t => t.id === ct.teacher_id);
      return teacher?.name || '알 수 없음';
    });

    return teacherNames.join(', ');
  }, [classTeachers, teachers]);

  const formDefaultValues = useMemo(() => {
    // subject 값이 기본 옵션에 없으면 직접입력으로 처리
    const predefinedSubjects = ['국어', '영어', '수학', '과학'];
    const isCustomSubject = classData.subject && !predefinedSubjects.includes(classData.subject);

    return {
      name: classData.name || '',
      subject: isCustomSubject ? '__custom__' : (classData.subject || ''),
      subject_custom: isCustomSubject ? classData.subject : '',
      grade: classData.grade || undefined,
      day_of_week: classData.day_of_week || undefined,
      start_time: classData.start_time?.substring(0, 5) || '14:00',
      end_time: classData.end_time?.substring(0, 5) || '15:30',
      capacity: classData.capacity || 20,
      teacher_ids: classTeachers.map((ct) => ct.teacher_id),
      notes: classData.notes || '',
      status: classData.status || 'active',
    };
  }, [classData, classTeachers]);

  const editSchema = useMemo(() => ({
    ...effectiveFormSchema,
    form: {
      ...effectiveFormSchema.form,
      submit: {
        label: '저장',
        variant: 'solid' as const,
        color: 'primary' as const,
        size: 'md' as const,
      },
    },
  }), [effectiveFormSchema]);

  const readOnlyFields = useMemo(() => [
    { label: `${terms.GROUP_LABEL}명`, value: classData.name || '-' },
    { label: '과목', value: classData.subject || '-' },
    { label: '요일', value: dayLabel },
    { label: '시간', value: `${classData.start_time?.substring(0, 5) || ''} ~ ${classData.end_time?.substring(0, 5) || ''}` },
    { label: terms.CAPACITY_LABEL, value: `${classData.current_count} / ${classData.capacity}명 (${((classData.current_count / classData.capacity) * 100).toFixed(0)}%)` },
    { label: '학년', value: gradeLabel },
    { label: `담당 ${terms.PERSON_LABEL_SECONDARY}`, value: teacherLabel },
    { label: '운영 상태', value: classData.status === 'active' ? '운영 중' : '중단' },
    { label: '메모', value: classData.notes || '-', colSpan: 2 },
  ], [classData, dayLabel, gradeLabel, teacherLabel, terms]);

  const handleSubmit = useCallback(async (data: Record<string, unknown>) => {
    // subject: 직접입력 선택 시 subject_custom 값 사용
    const subjectValue = data.subject === '__custom__'
      ? (data.subject_custom ? String(data.subject_custom) : undefined)
      : (data.subject ? String(data.subject) : undefined);

    const input: UpdateClassInput = {
      name: data.name ? String(data.name) : undefined,
      subject: subjectValue,
      // grade: 배열 또는 단일 값 지원
      grade: data.grade && Array.isArray(data.grade) && data.grade.length > 0
        ? data.grade
        : data.grade
        ? String(data.grade)
        : undefined,
      // day_of_week: 배열 또는 단일 값 지원
      day_of_week: data.day_of_week && Array.isArray(data.day_of_week) && data.day_of_week.length > 0
        ? data.day_of_week as DayOfWeek[]
        : data.day_of_week
        ? data.day_of_week as DayOfWeek
        : undefined,
      start_time: data.start_time ? `${String(data.start_time)}:00` : undefined,
      end_time: data.end_time ? `${String(data.end_time)}:00` : undefined,
      capacity: data.capacity ? Number(data.capacity) : undefined,
      teacher_ids: data.teacher_ids && Array.isArray(data.teacher_ids) ? data.teacher_ids as string[] : undefined,
      notes: data.notes ? String(data.notes) : undefined,
      status: data.status as ClassStatus | undefined,
    };

    await onSave(classData.id, input);
  }, [classData.id, onSave]);

  if (!isEditing) {
    return (
      <div>
        <Card padding="md">
          {/* 수정폼과 동일한 2열 그리드 레이아웃, 텍스트만 출력 */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isMobileMode ? '1fr' : 'repeat(2, minmax(0, 1fr))',
              gap: 'var(--spacing-md)',
            }}
          >
            {readOnlyFields.map((field, idx) => (
              <div
                key={idx}
                style={{
                  gridColumn: field.colSpan === 2 ? (isMobileMode ? 'span 1' : 'span 2') : undefined,
                  display: 'flex',
                  width: '100%',
                  alignItems: field.label === '메모' ? 'flex-start' : 'center',
                  paddingTop: 'var(--spacing-sm)',
                  paddingBottom: 'var(--spacing-sm)',
                  paddingLeft: 'var(--spacing-form-horizontal-left)',
                  paddingRight: 'var(--spacing-form-horizontal-right)',
                  borderBottom: 'var(--border-width-thin) solid var(--color-table-row-border)',
                }}
              >
                <span
                  style={{
                    color: 'var(--color-form-inline-label)',
                    fontSize: 'var(--font-size-base)',
                    fontFamily: 'var(--font-family)',
                    fontWeight: 'var(--font-weight-normal)',
                    lineHeight: 'var(--line-height)',
                    minWidth: 'var(--width-form-inline-label)',
                    flexShrink: 0,
                    marginRight: 'var(--spacing-form-inline-label-gap)',
                  }}
                >
                  {field.label}
                </span>
                <span
                  style={{
                    color: 'var(--color-text)',
                    fontSize: 'var(--font-size-base)',
                    fontFamily: 'var(--font-family)',
                    fontWeight: 'var(--font-weight-normal)',
                    lineHeight: 'var(--line-height)',
                    whiteSpace: field.label === '메모' ? 'pre-wrap' : 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {field.value}
                </span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 'var(--spacing-md)', display: 'flex', justifyContent: 'flex-end' }}>
            <IconButtonGroup
              align="right"
              items={[
                {
                  icon: Trash2,
                  tooltip: '삭제',
                  variant: 'outline' as const,
                  color: 'error' as const,
                  onClick: onDelete,
                },
                {
                  icon: Pencil,
                  tooltip: '수정',
                  variant: 'outline' as const,
                  onClick: onEdit,
                },
              ]}
            />
          </div>
        </Card>
      </div>
    );
  }

  // 수정 모드
  return (
    <div>
      <SchemaForm
        schema={editSchema}
        defaultValues={formDefaultValues}
        onSubmit={handleSubmit}
        onCancel={onCancel}
        disableCardPadding={false}
        cardTitle={undefined}
      />
    </div>
  );
}
