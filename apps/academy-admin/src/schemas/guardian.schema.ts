/**
 * Guardian Form Schema
 *
 * [불변 규칙] 스키마 엔진 기반 FormSchema 정의
 * [SDUI v1.1] Action Engine 지원, i18n 키 지원
 */

import type { FormSchema } from '@schema-engine';

export const guardianFormSchema: FormSchema = {
  version: '1.0.0',
  minSupportedClient: '1.0.0',
  entity: 'guardian',
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
          labelKey: 'GUARDIAN.FORM.NAME.LABEL',
          label: '이름',
          colSpan: 1,
        },
        validation: {
          required: true,
        },
      },
      {
        name: 'relationship',
        kind: 'select',
        ui: {
          labelKey: 'GUARDIAN.FORM.RELATIONSHIP.LABEL',
          label: '관계',
          colSpan: 1,
        },
        options: [
          { labelKey: 'GUARDIAN.FORM.RELATIONSHIP.PARENT', label: '부모', value: 'parent' },
          { labelKey: 'GUARDIAN.FORM.RELATIONSHIP.GUARDIAN', label: '보호자', value: 'guardian' },
          { labelKey: 'GUARDIAN.FORM.RELATIONSHIP.OTHER', label: '기타', value: 'other' },
        ],
        defaultValue: 'parent',
        validation: {
          required: true,
        },
      },
      {
        name: 'phone',
        kind: 'phone',
        ui: {
          labelKey: 'GUARDIAN.FORM.PHONE.LABEL',
          label: '전화번호',
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
          labelKey: 'GUARDIAN.FORM.EMAIL.LABEL',
          label: '이메일',
          colSpan: 1,
        },
      },
      {
        name: 'is_primary',
        kind: 'checkbox',
        ui: {
          labelKey: 'GUARDIAN.FORM.IS_PRIMARY.LABEL',
          label: '주 보호자',
          colSpan: 1,
        },
        defaultValue: false,
      },
      {
        name: 'notes',
        kind: 'textarea',
        ui: {
          labelKey: 'GUARDIAN.FORM.NOTES.LABEL',
          label: '메모',
          colSpan: 2,
        },
      },
    ],
    submit: {
      label: '저장',
      variant: 'solid',
      color: 'primary',
      size: 'md',
    },
    // [불변 규칙] actions를 명시적으로 비활성화하여 SchemaForm이 자동 API 호출을 하지 않도록 함
    // StudentsPage에서 handleSubmit을 통해 onCreate/onUpdate를 직접 처리
    actions: [],
  },
  // 최상위 actions도 비활성화
  actions: [],
};

