/**
 * Teacher Revenue Split Form Schema
 *
 * [불변 규칙] 스키마 엔진 기반 FormSchema 정의
 * [요구사항] 강사 매출 배분 (옵션)
 */

import type { FormSchema } from '@schema-engine';

export const teacherRevenueSplitFormSchema: FormSchema = {
  version: '1.0.0',
  minSupportedClient: '1.0.0',
  entity: 'teacher_revenue_split',
  type: 'form',
  form: {
    layout: {
      columns: 1,
      columnGap: 'md',
      rowGap: 'md',
    },
    fields: [
      {
        name: 'enabled',
        kind: 'checkbox',
        ui: {
          label: '강사 매출 배분 활성화',
          description: '강사별 매출 배분 기능을 활성화합니다.',
        },
      },
      {
        name: 'split_method',
        kind: 'select',
        ui: {
          label: '배분 방식',
        },
        options: [
          { value: 'equal', label: '균등 배분' },
          { value: 'proportional', label: '비례 배분' },
          { value: 'custom', label: '사용자 정의' },
        ],
        validation: {
          required: true,
        },
        condition: {
          field: 'enabled',
          op: 'eq',
          value: true,
        },
      },
      {
        name: 'split_percentage',
        kind: 'number',
        ui: {
          label: '배분 비율 (%)',
          description: '강사에게 배분할 매출 비율입니다.',
        },
        validation: {
          required: true,
          min: 0,
          max: 100,
        },
        condition: {
          field: 'enabled',
          op: 'eq',
          value: true,
        },
      },
    ],
    submit: {
      labelKey: 'TEACHER_REVENUE_SPLIT.FORM.SUBMIT',
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
        endpoint: 'teacher-revenue-split/settings',
        method: 'POST',
        body: 'form',
      },
      {
        event: 'onSubmitSuccess',
        type: 'toast',
        messageKey: 'TEACHER_REVENUE_SPLIT.SAVE.SUCCESS',
        message: '강사 매출 배분 설정이 저장되었습니다.',
        variant: 'success',
      },
      {
        event: 'onSubmitError',
        type: 'toast',
        messageKey: 'TEACHER_REVENUE_SPLIT.SAVE.ERROR',
        message: '강사 매출 배분 설정 저장에 실패했습니다.',
        variant: 'error',
      },
    ],
  },
};

