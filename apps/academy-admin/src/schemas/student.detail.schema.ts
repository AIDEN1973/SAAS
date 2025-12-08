/**
 * Student Detail Schema
 * 
 * [불변 규칙] 스키마 엔진 기반 DetailSchema 정의
 */

import type { DetailSchema } from '@schema-engine';

export const studentDetailSchema: DetailSchema = {
  version: '1.0.0',
  minSupportedClient: '1.0.0',
  entity: 'student',
  type: 'detail',
  detail: {
    layout: {
      columns: 2,
      columnGap: 'md',
      rowGap: 'md',
    },
    fields: [
      {
        name: 'name',
        kind: 'text',
        ui: {
          label: '이름',
          colSpan: 1,
        },
      },
      {
        name: 'birth_date',
        kind: 'date',
        ui: {
          label: '생년월일',
          colSpan: 1,
        },
      },
      {
        name: 'gender',
        kind: 'text',
        ui: {
          label: '성별',
          colSpan: 1,
        },
      },
      {
        name: 'phone',
        kind: 'text',
        ui: {
          label: '전화번호',
          colSpan: 1,
        },
      },
      {
        name: 'email',
        kind: 'text',
        ui: {
          label: '이메일',
          colSpan: 1,
        },
      },
      {
        name: 'address',
        kind: 'text',
        ui: {
          label: '주소',
          colSpan: 2,
        },
      },
      {
        name: 'school_name',
        kind: 'text',
        ui: {
          label: '학교',
          colSpan: 1,
        },
      },
      {
        name: 'grade',
        kind: 'text',
        ui: {
          label: '학년',
          colSpan: 1,
        },
      },
      {
        name: 'status',
        kind: 'text',
        ui: {
          label: '상태',
          colSpan: 1,
        },
      },
      {
        name: 'notes',
        kind: 'textarea',
        ui: {
          label: '비고',
          colSpan: 2,
        },
      },
    ],
  },
};

