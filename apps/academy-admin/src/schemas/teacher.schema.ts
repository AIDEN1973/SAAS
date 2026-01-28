/**
 * Teacher Form Schema
 *
 * [불변 규칙] 스키마 엔진 기반 FormSchema 정의
 */

import type { FormSchema } from '@schema-engine';
import { ACADEMY_SPECIALIZATIONS } from '@industry/academy';

export const teacherFormSchema: FormSchema = {
  version: '1.0.0',
  minSupportedClient: '1.0.0',
  entity: 'academy_teachers',
  type: 'form',
  form: {
    layout: {
      columns: 2,
      columnGap: 'md',
      rowGap: 'md',
    },
    fields: [
      {
        name: 'profile_image',
        kind: 'file',
        ui: {
          label: '프로필 사진',
          colSpan: 1,
          rowSpan: 6,
        },
      },
      {
        name: 'name',
        kind: 'text',
        ui: {
          labelKey: 'TEACHER.NAME',
          label: '선생님 이름',
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
          colSpan: 1,
        },
        validation: {
          required: true,
        },
      },
      {
        name: 'login_id',
        kind: 'email',
        ui: {
          label: '로그인용 이메일',
          colSpan: 1,
          placeholder: '이메일 주소 입력',
          description: '로그인에 사용할 이메일',
        },
        validation: {
          required: true,
        },
      },
      {
        name: 'password',
        kind: 'password',
        ui: {
          label: '비밀번호',
          colSpan: 1,
          placeholder: '비밀번호 입력',
          description: '8자 이상',
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
          colSpan: 1,
          placeholder: '비밀번호 재입력',
          description: '비밀번호를 다시 입력하세요',
        },
        validation: {
          required: true,
          minLength: 8,
        },
      },
      {
        name: 'profile_image_button',
        kind: 'custom',
        customComponentType: 'profile_image_button',
        ui: {
          colSpan: 1,
        },
      },
      {
        name: 'position',
        kind: 'select',
        options: [
          { value: 'vice_principal', label: '부원장' },
          { value: 'manager', label: '실장' },
          { value: 'teacher', label: '선생님' },
          { value: 'assistant', label: '조교' },
          { value: 'other', label: '기타' },
        ],
        ui: {
          label: '구분',
          colSpan: 1,
        },
        validation: {
          required: true,
        },
      },
      {
        name: 'gender',
        kind: 'select',
        options: [
          { value: 'male', label: '남성' },
          { value: 'female', label: '여성' },
        ],
        ui: {
          label: '성별',
          colSpan: 1,
        },
        validation: {
          required: true,
        },
      },
      {
        name: 'specialization',
        kind: 'select',
        options: [...ACADEMY_SPECIALIZATIONS],
        ui: {
          labelKey: 'TEACHER.SPECIALIZATION',
          label: '담당과목',
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
        name: 'status',
        kind: 'select',
        options: [
          { value: 'active', label: '재직중' },
          { value: 'on_leave', label: '휴직' },
          { value: 'resigned', label: '퇴직' },
        ],
        ui: {
          label: '상태',
          colSpan: 1,
        },
        validation: {
          required: true,
        },
      },
      {
        name: 'employee_id',
        kind: 'text',
        ui: {
          label: '사번',
          colSpan: 1,
        },
      },
      {
        name: 'pay_type',
        kind: 'select',
        options: [
          { value: 'monthly', label: '월급' },
          { value: 'hourly', label: '시급' },
        ],
        ui: {
          label: '급여 유형',
          colSpan: 1,
        },
      },
      {
        name: 'base_salary',
        kind: 'number',
        ui: {
          label: '기본급 (월)',
          colSpan: 1,
          placeholder: '원',
        },
      },
      {
        name: 'hourly_rate',
        kind: 'number',
        ui: {
          label: '시급',
          colSpan: 1,
          placeholder: '원',
        },
      },
      {
        name: 'bank_name',
        kind: 'text',
        ui: {
          label: '은행명',
          colSpan: 1,
        },
      },
      {
        name: 'bank_account',
        kind: 'text',
        ui: {
          label: '계좌번호',
          colSpan: 1,
        },
      },
      {
        name: 'salary_notes',
        kind: 'textarea',
        ui: {
          label: '급여 메모',
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
    // SDUI v1.1: Action Engine 지원
    // Note: onSubmit은 TeachersPage에서 handleCreateTeacher로 직접 처리
    actions: [
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

