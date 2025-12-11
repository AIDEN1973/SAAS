/**
 * Product Form Schema
 *
 * [불변 규칙] 스키마 엔진 기반 FormSchema 정의
 * [불변 규칙] Tailwind 클래스 직접 사용 금지, props 기반 전달
 */

import type { FormSchema } from '@schema-engine';

export const productFormSchema: FormSchema = {
  version: '1.0.0',
  minSupportedClient: '1.0.0',
  entity: 'product',
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
          label: '상품명',
          placeholder: '상품명을 입력하세요',
          colSpan: 1,
        },
        validation: {
          required: true,
        },
      },
      {
        name: 'product_type',
        kind: 'select',
        ui: {
          label: '상품 유형',
          colSpan: 1,
        },
        options: [
          { value: 'monthly', label: '월정액' },
          { value: 'session', label: '횟수제' },
          { value: 'package', label: '패키지' },
        ],
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
          colSpan: 1,
        },
        validation: {
          required: true,
          min: 0,
        },
      },
      {
        name: 'description',
        kind: 'textarea',
        ui: {
          label: '설명',
          placeholder: '상품 설명을 입력하세요',
          colSpan: 2,
        },
      },
    ],
    submit: {
      labelKey: 'PRODUCT.FORM.SUBMIT',
      label: '저장',
      variant: 'solid',
      color: 'primary',
      size: 'md',
    },
    // SDUI v1.1: Action Engine 지원
    actions: [
      {
        event: 'onSubmit',
        type: 'api.call',
        endpoint: 'products',
        method: 'POST',
        body: 'form',
      },
      {
        event: 'onSubmitSuccess',
        type: 'toast',
        messageKey: 'PRODUCT.SAVE.SUCCESS',
        message: '상품이 저장되었습니다.',
        variant: 'success',
      },
      {
        event: 'onSubmitError',
        type: 'toast',
        messageKey: 'PRODUCT.SAVE.ERROR',
        message: '상품 저장에 실패했습니다.',
        variant: 'error',
      },
    ],
  },
};

