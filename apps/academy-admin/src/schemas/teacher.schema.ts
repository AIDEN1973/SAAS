/**
 * Teacher Form Schema
 * 
 * [불�? 규칙] ?�키�??�진 기반 FormSchema ?�의
 */

import type { FormSchema } from '@schema/engine';

export const teacherFormSchema: FormSchema = {
  version: '1.0.0',
  minSupportedClient: '1.0.0',
  entity: 'teacher',
  type: 'form',
  form: {
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
          label: '?�름',
          colSpan: 1,
        },
        validation: {
          required: true,
        },
      },
      {
        name: 'email',
        kind: 'email',
        ui: {
          label: '?�메??,
          colSpan: 1,
        },
      },
      {
        name: 'phone',
        kind: 'phone',
        ui: {
          label: '?�화번호',
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
        name: 'employee_id',
        kind: 'text',
        ui: {
          label: '?�원번호',
          colSpan: 1,
        },
      },
      {
        name: 'specialization',
        kind: 'text',
        ui: {
          label: '?�문 분야',
          colSpan: 1,
        },
      },
      {
        name: 'hire_date',
        kind: 'date',
        ui: {
          label: '?�사??,
          colSpan: 1,
        },
      },
      {
        name: 'bio',
        kind: 'textarea',
        ui: {
          label: '강사 ?�개',
          colSpan: 2,
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
    submit: {
      label: '?�록',
      variant: 'solid',
      color: 'primary',
      size: 'md',
    },
  },
};

