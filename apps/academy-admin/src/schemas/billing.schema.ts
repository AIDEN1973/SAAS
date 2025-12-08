/**
 * Billing Form Schema
 *
 * [불변 규칙] 스키마 엔진 기반 FormSchema 정의
 * [불변 규칙] Tailwind 클래스 직접 사용 금지, props 기반 전달
 */

import type { FormSchema } from '@schema-engine';

export const billingFormSchema: FormSchema = {
  version: '1.0.0',
  minSupportedClient: '1.0.0',
  entity: 'invoice',
  type: 'form',
  form: {
    layout: {
      columns: 1,
      columnGap: 'md',
      rowGap: 'md',
    },
    fields: [
      {
        name: 'payer_id',
        kind: 'text',
        ui: {
          label: '납부자 ID',
          placeholder: '납부자 ID를 입력하세요',
        },
        validation: {
          required: true,
        },
      },
      {
        name: 'amount',
        kind: 'number',
        ui: {
          label: '금액',
          placeholder: '금액을 입력하세요',
        },
        validation: {
          required: true,
          min: 0,
        },
      },
      {
        name: 'due_date',
        kind: 'date',
        ui: {
          label: '마감일',
        },
        validation: {
          required: true,
        },
      },
    ],
    submit: {
      labelKey: 'INVOICE.FORM.SUBMIT',
      label: '생성',
      variant: 'solid',
      color: 'primary',
      size: 'md',
    },
    // SDUI v1.1: Action Engine 지원
    actions: [
      {
        event: 'onSubmit',
        type: 'api.call',
        endpoint: 'invoices',
        method: 'POST',
        body: 'form',
      },
      {
        event: 'onSubmitSuccess',
        type: 'toast',
        messageKey: 'INVOICE.CREATE.SUCCESS',
        message: '인보이스가 생성되었습니다.',
        variant: 'success',
      },
      {
        event: 'onSubmitError',
        type: 'toast',
        messageKey: 'INVOICE.CREATE.ERROR',
        message: '인보이스 생성에 실패했습니다.',
        variant: 'error',
      },
    ],
  },
};

