/**
 * Signup Form Schema
 *
 * [불변 규칙] 스키마 엔진 기반 FormSchema 정의
 * [불변 규칙] Tailwind 클래스 직접 사용 금지, props 기반 전달
 */

import type { FormSchema } from '@schema-engine';

export const signupFormSchema: FormSchema = {
  version: '1.0.0',
  minSupportedClient: '1.0.0',
  entity: 'signup',
  type: 'form',
  form: {
    layout: {
      columns: 2,
      columnGap: 'md',
      rowGap: 'md',
    },
    fields: [
      // 사용자 정보 섹션
      {
        name: 'name',
        kind: 'text',
        ui: {
          label: '이름',
          colSpan: 1,
        },
        validation: {
          required: '이름을 입력해주세요.',
        },
        defaultValue: '',
      },
      {
        name: 'email',
        kind: 'email',
        ui: {
          label: '이메일',
          colSpan: 1,
        },
        validation: {
          required: '이메일을 입력해주세요.',
        },
        defaultValue: '',
      },
      {
        name: 'phone',
        kind: 'phone',
        ui: {
          label: '전화번호 (선택)',
          placeholder: '010-1234-5678',
          colSpan: 1,
        },
        defaultValue: '',
      },
      {
        name: 'password',
        kind: 'password',
        ui: {
          label: '비밀번호',
          colSpan: 1,
        },
        validation: {
          required: '비밀번호를 입력해주세요.',
          minLength: 8,
        },
        defaultValue: '',
      },
      {
        name: 'passwordConfirm',
        kind: 'password',
        ui: {
          label: '비밀번호 확인',
          colSpan: 1,
        },
        validation: {
          required: '비밀번호 확인을 입력해주세요.',
          // ⚠️ 참고: validate 함수는 Schema Registry(JSONB)에 저장될 수 없고,
          // formValues를 받을 수 없으므로, 비밀번호 확인은 클라이언트 측에서 별도로 처리해야 합니다.
          // validate: (value: any) => boolean | string;  // 단일 value만 받을 수 있음
        },
        defaultValue: '',
      },
      // 테넌트 정보 섹션
      {
        name: 'tenantName',
        kind: 'text',
        ui: {
          label: '테넌트 이름',
          placeholder: '예: 서울 학원',
          colSpan: 1,
        },
        validation: {
          required: '테넌트 이름을 입력해주세요.',
        },
        defaultValue: '',
      },
      {
        name: 'industryType',
        kind: 'select',
        ui: {
          label: '업종',
          colSpan: 1,
        },
        options: [
          { label: '학원', value: 'academy' },
          { label: '미용실', value: 'salon' },
          { label: '부동산', value: 'real_estate' },  // 정본: real_estate (언더스코어 필수)
          { label: '헬스장', value: 'gym' },
          { label: '비영리단체', value: 'ngo' },
        ],
        validation: {
          required: '업종을 선택해주세요.',
        },
        defaultValue: 'academy',
      },
    ],
    submit: {
      label: '회원가입',
      variant: 'solid',
      color: 'primary',
      size: 'md',
    },
  },
};

