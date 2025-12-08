/**
 * Consultation Form Schema
 *
 * [불변 규칙] 스키마 엔진 기반 FormSchema 정의
 * [SDUI v1.1] Action Engine 지원, i18n 키 지원
 */

import type { FormSchema } from '@schema-engine';

export const consultationFormSchema: FormSchema = {
  version: '1.0.0',
  minSupportedClient: '1.0.0',
  entity: 'consultation',
  type: 'form',
  form: {
    layout: {
      columns: 1,
      columnGap: 'md',
      rowGap: 'md',
    },
    fields: [
      {
        name: 'consultation_date',
        kind: 'date',
        ui: {
          labelKey: 'CONSULTATION.FORM.DATE.LABEL',
          label: '상담일자',
          colSpan: 1,
        },
        validation: {
          required: true,
        },
      },
      {
        name: 'consultation_type',
        kind: 'select',
        ui: {
          labelKey: 'CONSULTATION.FORM.TYPE.LABEL',
          label: '상담 유형',
          colSpan: 1,
        },
        options: [
          { labelKey: 'CONSULTATION.FORM.TYPE.COUNSELING', label: '상담', value: 'counseling' },
          { labelKey: 'CONSULTATION.FORM.TYPE.LEARNING', label: '학습', value: 'learning' },
          { labelKey: 'CONSULTATION.FORM.TYPE.BEHAVIOR', label: '행동', value: 'behavior' },
          { labelKey: 'CONSULTATION.FORM.TYPE.OTHER', label: '기타', value: 'other' },
        ],
        validation: {
          required: true,
        },
      },
      {
        name: 'content',
        kind: 'textarea',
        ui: {
          labelKey: 'CONSULTATION.FORM.CONTENT.LABEL',
          label: '상담 내용',
          colSpan: 1,
        },
        validation: {
          required: true,
        },
      },
    ],
    submit: {
      labelKey: 'CONSULTATION.FORM.SUBMIT',
      label: '저장',
      variant: 'solid',
      color: 'primary',
      size: 'md',
    },
    actions: [
      {
        event: 'onSubmit',
        type: 'api.call',
        endpoint: 'consultations',
        method: 'POST',
        body: 'form',
      },
      {
        event: 'onSubmitSuccess',
        type: 'toast',
        messageKey: 'CONSULTATION.SAVE.SUCCESS',
        message: '상담일지가 저장되었습니다.',
        variant: 'success',
      },
      {
        event: 'onSubmitError',
        type: 'toast',
        messageKey: 'CONSULTATION.SAVE.ERROR',
        message: '상담일지 저장에 실패했습니다.',
        variant: 'error',
      },
    ],
  },
};

