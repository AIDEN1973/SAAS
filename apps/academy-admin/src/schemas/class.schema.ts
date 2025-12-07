/**
 * Class Form Schema
 * 
 * [불변 규칙] 스키마 엔진 기반 FormSchema 정의
 */

import type { FormSchema } from '@schema-engine';

export const classFormSchema: FormSchema = {
  version: '1.0.0',
  minSupportedClient: '1.0.0',
  entity: 'class',
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
          label: '반 이름',
          colSpan: 2,
        },
        validation: {
          required: true,
        },
      },
      {
        name: 'subject',
        kind: 'text',
        ui: {
          label: '과목',
          colSpan: 1,
        },
      },
      {
        name: 'grade',
        kind: 'text',
        ui: {
          label: '대상 학년',
          colSpan: 1,
        },
      },
      {
        name: 'day_of_week',
        kind: 'select',
        ui: {
          label: '요일',
          colSpan: 1,
        },
        options: [
          { label: '월요일', value: 'monday' },
          { label: '화요일', value: 'tuesday' },
          { label: '수요일', value: 'wednesday' },
          { label: '목요일', value: 'thursday' },
          { label: '금요일', value: 'friday' },
          { label: '토요일', value: 'saturday' },
          { label: '일요일', value: 'sunday' },
        ],
        defaultValue: 'monday',
        validation: {
          required: true,
        },
      },
      {
        name: 'start_time',
        kind: 'text',
        ui: {
          label: '시작 시간',
          placeholder: '14:00',
          colSpan: 1,
        },
        validation: {
          required: true,
          pattern: {
            value: '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$',
            message: '시간 형식이 올바르지 않습니다 (예: 14:00)',
          },
        },
      },
      {
        name: 'end_time',
        kind: 'text',
        ui: {
          label: '종료 시간',
          placeholder: '15:30',
          colSpan: 1,
        },
        validation: {
          required: true,
          pattern: {
            value: '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$',
            message: '시간 형식이 올바르지 않습니다 (예: 15:30)',
          },
        },
      },
      {
        name: 'capacity',
        kind: 'number',
        ui: {
          label: '정원',
          colSpan: 1,
        },
        validation: {
          required: true,
          min: 1,
        },
        defaultValue: 20,
      },
      {
        name: 'room',
        kind: 'text',
        ui: {
          label: '강의실',
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
    submit: {
      label: '생성',
      variant: 'solid',
      color: 'primary',
      size: 'md',
    },
  },
};

