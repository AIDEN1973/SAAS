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
          placeholder: '수업명을 검색하세요.',
          colSpan: 1,
        },
      },
      {
        name: 'status',
        kind: 'select',
        ui: {
          label: '운영 상태',
          placeholder: '운영 상태를 선택하세요.',
          colSpan: 1,
        },
        options: [
          { label: '전체', value: '' },
          { label: '운영 중', value: 'active' },
          { label: '중단', value: 'inactive' },
        ],
        defaultValue: '',
      },
      {
        name: 'day_of_week',
        kind: 'select',
        ui: {
          label: '요일',
          placeholder: '요일을 선택하세요.',
          colSpan: 1,
        },
        options: [
          { label: '전체', value: '' },
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

