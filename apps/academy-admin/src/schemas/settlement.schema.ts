/**
 * Settlement Form Schema
 *
 * [불변 규칙] 스키마 엔진 기반 FormSchema 정의
 * [요구사항] 월별 정산 실행
 */

import type { FormSchema } from '@schema-engine';
import { toKST } from '@lib/date-utils';

export const settlementFormSchema: FormSchema = {
  version: '1.0.0',
  minSupportedClient: '1.0.0',
  entity: 'settlement',
  type: 'form',
  form: {
    layout: {
      columns: 2,
      columnGap: 'md',
      rowGap: 'md',
    },
    fields: [
      {
        name: 'year',
        kind: 'number',
        ui: {
          label: '연도',
          colSpan: 1,
        },
        validation: {
          required: true,
          min: 2020,
          max: 2100,
        },
        defaultValue: toKST().year(),
      },
      {
        name: 'month',
        kind: 'number',
        ui: {
          label: '월',
          colSpan: 1,
        },
        validation: {
          required: true,
          min: 1,
          max: 12,
        },
        defaultValue: toKST().month() + 1,
      },
    ],
    submit: {
      label: '정산 실행',
      variant: 'solid',
      color: 'primary',
      size: 'md',
    },
    // SDUI v1.1: Action Engine 지원
    actions: [
      {
        event: 'onSubmit',
        type: 'api.call',
        endpoint: 'settlements/execute',
        method: 'POST',
        body: 'form',
      },
      {
        event: 'onSubmitSuccess',
        type: 'toast',
        messageKey: 'SETTLEMENT.EXECUTE.SUCCESS',
        message: '정산이 실행되었습니다.',
        variant: 'success',
      },
      {
        event: 'onSubmitError',
        type: 'toast',
        messageKey: 'SETTLEMENT.EXECUTE.ERROR',
        message: '정산 실행에 실패했습니다.',
        variant: 'error',
      },
    ],
  },
};

