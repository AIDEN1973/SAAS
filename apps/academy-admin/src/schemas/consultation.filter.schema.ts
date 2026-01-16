/**
 * Consultation Filter Schema
 *
 * [불변 규칙] 스키마 엔진 기반 FilterSchema 정의
 * 상담 목록 필터링을 위한 스키마
 */

import type { FilterSchema } from '@schema-engine';

export const consultationFilterSchema: FilterSchema = {
  version: '1.0.0',
  minSupportedClient: '1.0.0',
  entity: 'consultation',
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
          placeholder: '학생명 또는 내용으로 검색하세요.',
          colSpan: 1,
        },
      },
      {
        name: 'consultation_type',
        kind: 'select',
        ui: {
          placeholder: '상담 구분을 선택하세요.',
          colSpan: 1,
        },
        options: [
          { label: '전체 구분', value: '' },
          { label: '상담일지', value: 'counseling' },
          { label: '학습일지', value: 'learning' },
          { label: '행동일지', value: 'behavior' },
          { label: '기타', value: 'other' },
        ],
        defaultValue: '',
      },
      {
        name: 'date_from',
        kind: 'date',
        ui: {
          placeholder: '시작일을 선택하세요.',
          colSpan: 1,
        },
      },
      {
        name: 'date_to',
        kind: 'date',
        ui: {
          placeholder: '종료일을 선택하세요.',
          colSpan: 1,
        },
      },
    ],
  },
};
