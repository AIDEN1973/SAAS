/**
 * Class Filter Schema
 * 
 * [불변 규칙] 스키마 엔진 기반 FilterSchema 정의
 */

import type { FilterSchema } from '@schema-engine';

export const classFilterSchema: FilterSchema = {
  version: '1.0.0',
  minSupportedClient: '1.0.0',
  entity: 'class',
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
          placeholder: '반 이름 검색..',
          colSpan: 1,
        },
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
          { label: '운영중', value: 'active' },
          { label: '비활성', value: 'inactive' },
        ],
        defaultValue: '',
      },
      {
        name: 'day_of_week',
        kind: 'select',
        ui: {
          label: '요일',
          colSpan: 1,
        },
        options: [
          { label: '전체 요일', value: '' },
          { label: '월요일', value: 'monday' },
          { label: '화요일', value: 'tuesday' },
          { label: '수요일', value: 'wednesday' },
          { label: '목요일', value: 'thursday' },
          { label: '금요일', value: 'friday' },
          { label: '토요일', value: 'saturday' },
          { label: '일요일', value: 'sunday' },
        ],
        defaultValue: '',
      },
    ],
  },
};

