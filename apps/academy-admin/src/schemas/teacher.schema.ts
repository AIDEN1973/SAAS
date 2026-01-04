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
        kind: 'select',
        options: [
          { value: '수학', label: '수학' },
          { value: '영어', label: '영어' },
          { value: '국어', label: '국어' },
          { value: '과학', label: '과학' },
          { value: '사회', label: '사회' },
          { value: '예체능', label: '예체능' },
          { value: '음악', label: '음악' },
          { value: '미술', label: '미술' },
          { value: '체육', label: '체육' },
          { value: '코딩', label: '코딩' },
          { value: '논술', label: '논술' },
          { value: '기타', label: '기타' },
        ],
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
        name: 'profile_image_url',
        kind: 'text',
        ui: {
          label: '프로필 이미지 URL',
          placeholder: 'https://example.com/profile.jpg',
          description: '프로필 이미지 URL을 입력하세요 (선택사항)',
          colSpan: 2,
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
          label: '메모',
          colSpan: 2,
        },
      },
      {
        name: 'pay_type',
        kind: 'select',
        options: [
          { value: 'monthly', label: '월급제' },
          { value: 'hourly', label: '시급제' },
          { value: 'class_based', label: '수업별' },
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
          label: '기본급 (원)',
          placeholder: '2500000',
          colSpan: 1,
          description: '월급제 또는 수업별 기본 급여',
        },
      },
      {
        name: 'hourly_rate',
        kind: 'number',
        ui: {
          label: '시급 (원)',
          placeholder: '25000',
          colSpan: 1,
          description: '시급제 적용 시',
        },
      },
      {
        name: 'bank_name',
        kind: 'text',
        ui: {
          label: '은행명',
          placeholder: '국민은행',
          colSpan: 1,
        },
      },
      {
        name: 'bank_account',
        kind: 'text',
        ui: {
          label: '계좌번호',
          placeholder: '123-45-678901',
          colSpan: 1,
          description: '급여 지급 계좌',
        },
      },
      {
        name: 'salary_notes',
        kind: 'textarea',
        ui: {
          label: '급여 메모',
          colSpan: 2,
          description: '급여 관련 특이사항 또는 조정 이력',
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

