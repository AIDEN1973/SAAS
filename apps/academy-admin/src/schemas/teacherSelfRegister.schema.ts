/**
 * Teacher Self Register Form Schema
 *
 * [불변 규칙] 스키마 엔진 기반 FormSchema 정의
 * [업종중립] 강사/트레이너 자체 등록용
 */

import type { FormSchema } from '@schema-engine';

export const teacherSelfRegisterSchema: FormSchema = {
  version: '1.0.0',
  minSupportedClient: '1.0.0',
  entity: 'teacher_self_register',
  type: 'form',
  form: {
    layout: {
      columns: 1,
      columnGap: 'md',
      rowGap: 'md',
    },
    fields: [
      {
        name: 'name',
        kind: 'text',
        ui: {
          label: '이름',
          placeholder: '실명을 입력해주세요',
          colSpan: 1,
        },
        validation: {
          required: true,
        },
      },
      {
        name: 'phone',
        kind: 'phone',
        ui: {
          label: '휴대폰 번호',
          placeholder: '010-0000-0000',
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
          placeholder: 'example@email.com',
          colSpan: 1,
        },
      },
      {
        name: 'login_id',
        kind: 'text',
        ui: {
          label: '아이디',
          placeholder: '로그인용 아이디',
          description: '영문, 숫자 조합 (4자 이상)',
          colSpan: 1,
        },
        validation: {
          required: true,
          minLength: 4,
        },
      },
      {
        name: 'password',
        kind: 'password',
        ui: {
          label: '비밀번호',
          placeholder: '비밀번호',
          description: '8자 이상',
          colSpan: 1,
        },
        validation: {
          required: true,
          minLength: 8,
        },
      },
      {
        name: 'password_confirm',
        kind: 'password',
        ui: {
          label: '비밀번호 확인',
          placeholder: '비밀번호를 다시 입력해주세요',
          colSpan: 1,
        },
        validation: {
          required: true,
          minLength: 8,
        },
      },
    ],
    submit: {
      label: '등록하기',
      variant: 'solid',
      color: 'primary',
      size: 'lg',
    },
    actions: [],
  },
};
