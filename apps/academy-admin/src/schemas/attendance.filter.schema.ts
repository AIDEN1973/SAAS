/**
 * Attendance Filter Schema
 *
 * [불변 규칙] 스키마 엔진 기반 FilterSchema 정의
 * [불변 규칙] Factory Function 패턴으로 업종중립성 지원
 */

import type { FilterSchema } from '@schema-engine';
import type { IndustryTerms } from '@industry/registry';

/**
 * 동적 옵션을 포함한 필터 스키마 생성 함수
 */
export function createAttendanceFilterSchema(
  students?: Array<{ id: string; name: string }>,
  classes?: Array<{ id: string; name: string }>,
  terms?: IndustryTerms
): FilterSchema {
  const studentOptions = students
    ? [{ label: '전체', value: '' }, ...students.map((s) => ({ label: s.name, value: s.id }))]
    : [{ label: '전체', value: '' }];

  const classOptions = classes
    ? [{ label: '전체', value: '' }, ...classes.map((c) => ({ label: c.name, value: c.id }))]
    : [{ label: '전체', value: '' }];

  return {
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
            label: terms ? terms.PERSON_LABEL_PRIMARY : '학생',
            colSpan: 1,
          },
          options: studentOptions,
        },
        {
          name: 'class_id',
          kind: 'select',
          ui: {
            label: terms ? terms.GROUP_LABEL : '반',
            colSpan: 1,
          },
          options: classOptions,
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
            { label: terms ? terms.CHECK_IN_LABEL : '등원', value: 'check_in' },
            { label: terms ? terms.CHECK_OUT_LABEL : '하원', value: 'check_out' },
            { label: terms ? terms.LATE_LABEL : '지각', value: 'late' },
            { label: terms ? terms.ABSENCE_LABEL : '결석', value: 'absent' },
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
            { label: terms ? terms.PRESENT_LABEL : '출석', value: 'present' },
            { label: terms ? terms.LATE_LABEL : '지각', value: 'late' },
            { label: terms ? terms.ABSENCE_LABEL : '결석', value: 'absent' },
            { label: terms ? terms.EXCUSED_LABEL : '사유', value: 'excused' },
          ],
          defaultValue: '',
        },
      ],
    },
  };
}

/**
 * 출결 화면 헤더용 필터 스키마 (반 선택, 날짜 선택, 검색)
 */
export function createAttendanceHeaderFilterSchema(
  todayClasses?: Array<{ id: string; name: string }>,
  terms?: IndustryTerms
): FilterSchema {
  const classOptions = todayClasses
    ? [
        { label: terms ? `전체 ${terms.GROUP_LABEL}` : '전체 반', value: '' },
        ...todayClasses.map((c) => ({ label: c.name, value: c.id }))
      ]
    : [{ label: terms ? `전체 ${terms.GROUP_LABEL}` : '전체 반', value: '' }];

  return {
    version: '1.0.0',
    minSupportedClient: '1.0.0',
    entity: 'attendance_header',
    type: 'filter',
    filter: {
      layout: {
        columns: 3,
        columnGap: 'sm',
        rowGap: 'sm',
      },
      fields: [
        {
          name: 'class_id',
          kind: 'select',
          ui: {
            label: terms ? terms.GROUP_LABEL : '반',
            colSpan: 1,
          },
          options: classOptions,
          defaultValue: '',
        },
        {
          name: 'date',
          kind: 'date',
          ui: {
            label: '날짜',
            colSpan: 1,
          },
        },
        {
          name: 'search',
          kind: 'text',
          ui: {
            label: '검색',
            placeholder: terms
              ? `${terms.PERSON_LABEL_PRIMARY} 이름 또는 전화번호 검색`
              : '학생 이름 또는 전화번호 검색',
            colSpan: 1,
          },
        },
      ],
    },
  };
}

// Backward compatibility: Static schema for legacy usage
export const attendanceFilterSchema: FilterSchema = createAttendanceFilterSchema();
