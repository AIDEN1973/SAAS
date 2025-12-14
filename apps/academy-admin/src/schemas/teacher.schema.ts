/**
 * Teacher Form Schema
 *
 * [불변 규칙] 스키마 엔진 기반 FormSchema 정의
 */

import type { FormSchema } from '@schema-engine';

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
          label: '이름',
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
          label: '이메일',
          colSpan: 1,
        },
      },
      {
        name: 'phone',
        kind: 'phone',
        ui: {
          label: '전화번호',
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
          label: '사원번호',
          colSpan: 1,
        },
      },
      {
        name: 'specialization',
        kind: 'text',
        ui: {
          label: '전문 분야',
          colSpan: 1,
        },
      },
      {
        name: 'hire_date',
        kind: 'date',
        ui: {
          label: '입사일',
          colSpan: 1,
        },
      },
      {
        name: 'bio',
        kind: 'textarea',
        ui: {
          label: '강사 소개',
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
      label: '등록',
      variant: 'solid',
      color: 'primary',
      size: 'md',
    },
    // SDUI v1.1: Action Engine 지원
    actions: [
      {
        event: 'onSubmit',
        type: 'api.call',
        endpoint: 'teachers',
        method: 'POST',
        body: 'form',
      },
      {
        event: 'onSubmitSuccess',
        type: 'toast',
        messageKey: 'TEACHER.CREATE.SUCCESS',
        message: '강사가 등록되었습니다.',
        variant: 'success',
      },
      {
        event: 'onSubmitError',
        type: 'toast',
        messageKey: 'TEACHER.CREATE.ERROR',
        message: '강사 등록에 실패했습니다.',
        variant: 'error',
      },
    ],
  },
};

