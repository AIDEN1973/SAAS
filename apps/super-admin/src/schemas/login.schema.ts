/**
 * Login Form Schema
 * 
 * [불변 규칙] 스키마 엔진 기반 FormSchema 정의
 * [불변 규칙] Tailwind 클래스 직접 사용 금지, props 기반 전달
 */

import type { FormSchema } from '@schema-engine/types';

export const loginFormSchema: FormSchema = {
  version: '1.0.0',
  minSupportedClient: '1.0.0',
  entity: 'login',
  type: 'form',
  form: {
    fields: [
      {
        name: 'email',
        kind: 'email',
        ui: {
          label: '이메일',
        },
        validation: {
          required: '이메일을 입력해주세요.',
        },
        defaultValue: '',
      },
      {
        name: 'password',
        kind: 'password',
        ui: {
          label: '비밀번호',
        },
        validation: {
          required: '비밀번호를 입력해주세요.',
        },
        defaultValue: '',
      },
    ],
    submit: {
      label: '로그인',
      variant: 'solid',
      color: 'primary',
      size: 'md',
    },
  },
};

export const otpLoginFormSchema: FormSchema = {
  version: '1.0.0',
  minSupportedClient: '1.0.0',
  entity: 'otp_login',
  type: 'form',
  form: {
    fields: [
      {
        name: 'otp',
        kind: 'text',
        ui: {
          label: 'OTP 코드',
          placeholder: '6자리 코드',
        },
        validation: {
          required: 'OTP 코드를 입력해주세요.',
          minLength: 6,
          maxLength: 6,
        },
        defaultValue: '',
      },
    ],
    submit: {
      label: '로그인',
      variant: 'solid',
      color: 'primary',
      size: 'md',
    },
  },
};

