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
          labelKey: 'STUDENT.FORM.NAME.LABEL',
          label: '이름', // 하위 호환성
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
          labelKey: 'STUDENT.FORM.BIRTH_DATE.LABEL',
          label: '생년월일',
          colSpan: 1,
        },
      },
      {
        name: 'gender',
        kind: 'select',
        ui: {
          labelKey: 'STUDENT.FORM.GENDER.LABEL',
          label: '성별',
          colSpan: 1,
        },
        options: [
          { labelKey: 'STUDENT.FORM.GENDER.SELECT', label: '선택', value: '' },
          { labelKey: 'STUDENT.FORM.GENDER.MALE', label: '남', value: 'male' },
          { labelKey: 'STUDENT.FORM.GENDER.FEMALE', label: '여', value: 'female' },
        ],
      },
      {
        name: 'phone',
        kind: 'phone',
        ui: {
          labelKey: 'STUDENT.FORM.PHONE.LABEL',
          label: '전화번호',
          colSpan: 1,
        },
      },
      {
        name: 'email',
        kind: 'email',
        ui: {
          labelKey: 'STUDENT.FORM.EMAIL.LABEL',
          label: '이메일',
          colSpan: 1,
        },
      },
      {
        name: 'address',
        kind: 'text',
        ui: {
          labelKey: 'STUDENT.FORM.ADDRESS.LABEL',
          label: '주소',
          colSpan: 2,
        },
      },
      {
        name: 'school_name',
        kind: 'text',
        ui: {
          labelKey: 'STUDENT.FORM.SCHOOL_NAME.LABEL',
          label: '학교',
          colSpan: 1,
        },
      },
      {
        name: 'grade',
        kind: 'text',
        ui: {
          labelKey: 'STUDENT.FORM.GRADE.LABEL',
          label: '학년',
          colSpan: 1,
        },
      },
      {
        name: 'status',
        kind: 'select',
        ui: {
          labelKey: 'STUDENT.FORM.STATUS.LABEL',
          label: '상태',
          colSpan: 1,
        },
        options: [
          { labelKey: 'STUDENT.FORM.STATUS.ACTIVE', label: '재원', value: 'active' },
          { labelKey: 'STUDENT.FORM.STATUS.ON_LEAVE', label: '휴원', value: 'on_leave' },
          { labelKey: 'STUDENT.FORM.STATUS.WITHDRAWN', label: '퇴원', value: 'withdrawn' },
          { labelKey: 'STUDENT.FORM.STATUS.GRADUATED', label: '졸업', value: 'graduated' },
        ],
        defaultValue: 'active',
      },
      {
        name: 'notes',
        kind: 'textarea',
        ui: {
          labelKey: 'STUDENT.FORM.NOTES.LABEL',
          label: '비고',
          colSpan: 2,
        },
      },
    ],
    submit: {
      labelKey: 'STUDENT.FORM.SUBMIT',
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
        endpoint: 'students',
        method: 'POST',
        body: 'form',
      },
      {
        event: 'onSubmitSuccess',
        type: 'toast',
        messageKey: 'STUDENT.CREATE.SUCCESS',
        message: '학생이 등록되었습니다.',
        variant: 'success',
      },
      {
        event: 'onSubmitError',
        type: 'toast',
        messageKey: 'STUDENT.CREATE.ERROR',
        message: '학생 등록에 실패했습니다.',
        variant: 'error',
      },
    ],
  },
};

