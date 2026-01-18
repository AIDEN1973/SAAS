/**
 * Student Filter Schema
 *
 * [불변 규칙] 스키마 엔진 기반 FilterSchema 정의
 * [동적 옵션] 수업 목록은 동적으로 채워집니다.
 */

import type { FilterSchema } from '@schema-engine';
import type { Class } from '@services/class-service';

export function createStudentFilterSchema(classes?: Class[]): FilterSchema {
  return {
  version: '1.0.0',
  minSupportedClient: '1.0.0',
  entity: 'student',
  type: 'filter',
  filter: {
    layout: {
      columns: 4,
      columnGap: 'md',
      rowGap: 'sm',
    },
    fields: [
      {
        name: 'search',
        kind: 'text',
        ui: {
          placeholder: '이름으로 검색하세요.',
          colSpan: 1,
        },
      },
      {
        name: 'status',
        kind: 'select',
        ui: {
          placeholder: '재원상태를 선택하세요.',
          colSpan: 1,
        },
        options: [
          { label: '전체', value: '' },
          { label: '재원', value: 'active' },
          { label: '휴원', value: 'on_leave' },
          { label: '퇴원', value: 'withdrawn' },
          { label: '졸업', value: 'graduated' },
        ],
        defaultValue: '',
      },
      {
        name: 'grade',
        kind: 'select',
        ui: {
          placeholder: '학년을 선택하세요.',
          colSpan: 1,
        },
        options: [
          { label: '전체 학년', value: '' },
          { label: '1학년', value: '1학년' },
          { label: '2학년', value: '2학년' },
          { label: '3학년', value: '3학년' },
          { label: '중1', value: '중1' },
          { label: '중2', value: '중2' },
          { label: '중3', value: '중3' },
          { label: '고1', value: '고1' },
          { label: '고2', value: '고2' },
          { label: '고3', value: '고3' },
        ],
        defaultValue: '',
      },
      {
        name: 'class_id',
        kind: 'select',
        ui: {
          placeholder: '클래스를 선택하세요.',
          colSpan: 1,
        },
        options: [
          { label: '전체 수업', value: '' },
          ...(classes?.map((c) => ({ label: c.name, value: c.id })) || []),
        ],
        defaultValue: '',
      },
    ],
  },
  };
}

