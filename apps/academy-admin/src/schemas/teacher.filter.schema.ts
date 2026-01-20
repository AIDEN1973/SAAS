/**
 * Teacher Filter Schema
 * 
 * [불변 규칙] 스키마 엔진 기반 FilterSchema 정의
 */

import type { FilterSchema } from '@schema-engine';

export const teacherFilterSchema: FilterSchema = {
  version: '1.0.0',
  minSupportedClient: '1.0.0',
  entity: 'teacher',
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
          label: '검색',
          placeholder: '강사명을 검색하세요.',
          colSpan: 1,
        },
      },
      {
        name: 'status',
        kind: 'select',
        ui: {
          label: '상태',
          placeholder: '재직상태를 선택하세요.',
          colSpan: 1,
        },
        options: [
          { label: '전체', value: '' },
          { label: '재직중', value: 'active' },
          { label: '휴직', value: 'on_leave' },
          { label: '퇴직', value: 'resigned' },
        ],
        defaultValue: '',
      },
    ],
  },
};

