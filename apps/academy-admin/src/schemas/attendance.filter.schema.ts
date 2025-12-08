/**
 * Attendance Filter Schema
 * 
 * [불변 규칙] 스키마 엔진 기반 FilterSchema 정의
 */

import type { FilterSchema } from '@schema-engine';

export const attendanceFilterSchema: FilterSchema = {
  version: '1.0.0',
  minSupportedClient: '1.0.0',
  entity: 'attendance',
  type: 'filter',
  filter: {
    layout: {
      columns: 4,
      columnGap: 'md',
      rowGap: 'sm',
    },
    fields: [
      {
        name: 'date_from',
        kind: 'date',
        ui: {
          label: '시작일',
          colSpan: 1,
        },
      },
      {
        name: 'date_to',
        kind: 'date',
        ui: {
          label: '종료일',
          colSpan: 1,
        },
      },
      {
        name: 'student_id',
        kind: 'select',
        ui: {
          label: '학생',
          colSpan: 1,
        },
        options: [], // 동적으로 채워짐
      },
      {
        name: 'class_id',
        kind: 'select',
        ui: {
          label: '반',
          colSpan: 1,
        },
        options: [], // 동적으로 채워짐
      },
      {
        name: 'attendance_type',
        kind: 'select',
        ui: {
          label: '타입',
          colSpan: 1,
        },
        options: [
          { label: '전체', value: '' },
          { label: '등원', value: 'check_in' },
          { label: '하원', value: 'check_out' },
          { label: '지각', value: 'late' },
          { label: '결석', value: 'absent' },
        ],
        defaultValue: '',
      },
      {
        name: 'status',
        kind: 'select',
        ui: {
          label: '상태',
          colSpan: 1,
        },
        options: [
          { label: '전체', value: '' },
          { label: '출석', value: 'present' },
          { label: '지각', value: 'late' },
          { label: '결석', value: 'absent' },
          { label: '사유', value: 'excused' },
        ],
        defaultValue: '',
      },
    ],
  },
};

/**
 * 동적 옵션을 포함한 필터 스키마 생성 함수
 */
export function createAttendanceFilterSchema(
  students?: Array<{ id: string; name: string }>,
  classes?: Array<{ id: string; name: string }>
): FilterSchema {
  const studentOptions = students
    ? [{ label: '전체', value: '' }, ...students.map((s) => ({ label: s.name, value: s.id }))]
    : [{ label: '전체', value: '' }];

  const classOptions = classes
    ? [{ label: '전체', value: '' }, ...classes.map((c) => ({ label: c.name, value: c.id }))]
    : [{ label: '전체', value: '' }];

  return {
    ...attendanceFilterSchema,
    filter: {
      ...attendanceFilterSchema.filter,
      fields: attendanceFilterSchema.filter.fields.map((field) => {
        if (field.name === 'student_id') {
          return { ...field, options: studentOptions };
        }
        if (field.name === 'class_id') {
          return { ...field, options: classOptions };
        }
        return field;
      }),
    },
  };
}

