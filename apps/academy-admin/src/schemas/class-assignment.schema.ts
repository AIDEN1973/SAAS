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
      labelKey: 'CLASS_ASSIGNMENT.FORM.SUBMIT',
      label: '배정',
      variant: 'solid',
      color: 'primary',
      size: 'md',
    },
    actions: [
      {
        event: 'onSubmit',
        type: 'api.call',
        endpoint: 'class_assignments',
        method: 'POST',
        body: 'form',
      },
      {
        event: 'onSubmitSuccess',
        type: 'toast',
        messageKey: 'CLASS_ASSIGNMENT.SUCCESS',
        message: '반 배정이 완료되었습니다.',
        variant: 'success',
      },
      {
        event: 'onSubmitError',
        type: 'toast',
        messageKey: 'CLASS_ASSIGNMENT.ERROR',
        message: '반 배정에 실패했습니다.',
        variant: 'error',
      },
    ],
  },
};

