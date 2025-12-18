/**
 * Class Assignment Form Schema
 *
 * [불변 규칙] 스키마 엔진 기반 FormSchema 정의
 * [SDUI v1.1] Action Engine 지원, i18n 키 지원
 */

import type { FormSchema } from '@schema-engine';

export const classAssignmentFormSchema: FormSchema = {
  version: '1.0.0',
  minSupportedClient: '1.0.0',
  entity: 'class_assignment',
  type: 'form',
  form: {
    layout: {
      columns: 2,
      columnGap: 'md',
      rowGap: 'md',
    },
    fields: [
      {
        name: 'class_id',
        kind: 'select',
        ui: {
          labelKey: 'CLASS_ASSIGNMENT.FORM.CLASS_ID.LABEL',
          label: '반 선택',
          colSpan: 1,
        },
        validation: {
          required: true,
        },
      },
      {
        name: 'enrolled_at',
        kind: 'date',
        ui: {
          labelKey: 'CLASS_ASSIGNMENT.FORM.ENROLLED_AT.LABEL',
          label: '배정일',
          colSpan: 1,
        },
        validation: {
          required: true,
        },
      },
    ],
    submit: {
      label: '배정',
      variant: 'solid',
      color: 'primary',
      size: 'md',
    },
  },
};

