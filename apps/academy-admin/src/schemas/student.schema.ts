/**
 * Student Form Schema
 *
 * [불변 규칙] 스키마 엔진 기반 FormSchema 정의
 * [불변 규칙] Tailwind 클래스 직접 사용 금지, props 기반 전달
 * [SDUI v1.1] Action Engine 지원, i18n 키 지원
 */

import type { FormSchema } from '@schema-engine';

export const studentFormSchema: FormSchema = {
  version: '1.0.0',
  minSupportedClient: '1.0.0',
  entity: 'student',
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
        name: 'birth_date',
        kind: 'date',
        ui: {
          label: '생년월일',
          colSpan: 1,
        },
      },
      {
        name: 'gender',
        kind: 'select',
        ui: {
          label: '성별',
          colSpan: 1,
        },
        options: [
          { label: '선택', value: '' },
          { label: '남', value: 'male' },
          { label: '여', value: 'female' },
        ],
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
        name: 'email',
        kind: 'email',
        ui: {
          label: '이메일',
          colSpan: 1,
        },
      },
      {
        name: 'school_name',
        kind: 'text',
        ui: {
          label: '학교',
          colSpan: 1,
        },
      },
      {
        name: 'grade',
        kind: 'text',
        ui: {
          label: '학년',
          colSpan: 1,
        },
      },
      {
        name: 'status',
        kind: 'select',
        ui: {
          label: '상태',
          colSpan: 1,
        },
        options: [
          { label: '재원', value: 'active' },
          { label: '휴원', value: 'on_leave' },
          { label: '퇴원', value: 'withdrawn' },
          { label: '졸업', value: 'graduated' },
        ],
        defaultValue: 'active',
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
        name: 'notes',
        kind: 'textarea',
        ui: {
          label: '메모',
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
    // [불변 규칙] students는 VIEW이므로 직접 INSERT할 수 없습니다.
    // [불변 규칙] useCreateStudent Hook을 통해 persons + academy_students 테이블에 각각 생성합니다.
    // actions는 비활성화하고, 상위 컴포넌트의 onSubmit 핸들러에서 처리합니다.
    actions: [],
  },
};

