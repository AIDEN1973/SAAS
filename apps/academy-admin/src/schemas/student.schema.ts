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
          label: '학생 전화번호',
          colSpan: 1,
        },
      },
      {
        name: 'attendance_number',
        kind: 'text',
        ui: {
          label: '출결번호',
          colSpan: 1,
          placeholder: '출결번호 미입력 시 학생 전화번호 뒤 4자리 자동 적용',
        },
        validation: {
          pattern: {
            value: '^[0-9]{4,}$',
            message: '4자리 이상의 숫자만 입력 가능합니다',
          },
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
        name: 'father_phone',
        kind: 'phone',
        ui: {
          label: '아버지 전화번호',
          colSpan: 1,
        },
      },
      {
        name: 'mother_phone',
        kind: 'phone',
        ui: {
          label: '어머니 전화번호',
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
        kind: 'select',
        ui: {
          label: '학년',
          colSpan: 1,
        },
        validation: {
          required: true,
        },
        options: [
          { label: '선택', value: '' },
          { label: '4세', value: '4세' },
          { label: '5세', value: '5세' },
          { label: '6세', value: '6세' },
          { label: '7세', value: '7세', divider: true }, // 구분선
          { label: '초등 1학년', value: '초등 1학년' },
          { label: '초등 2학년', value: '초등 2학년' },
          { label: '초등 3학년', value: '초등 3학년' },
          { label: '초등 4학년', value: '초등 4학년' },
          { label: '초등 5학년', value: '초등 5학년' },
          { label: '초등 6학년', value: '초등 6학년', divider: true }, // 구분선
          { label: '중등 1학년', value: '중등 1학년' },
          { label: '중등 2학년', value: '중등 2학년' },
          { label: '중등 3학년', value: '중등 3학년', divider: true }, // 구분선
          { label: '고등 1학년', value: '고등 1학년' },
          { label: '고등 2학년', value: '고등 2학년' },
          { label: '고등 3학년', value: '고등 3학년', divider: true }, // 구분선
          { label: '기타', value: '기타' },
        ],
      },
      {
        name: 'address',
        kind: 'address',
        ui: {
          label: '주소',
          colSpan: 2,
          placeholder: '주소를 입력하거나 검색 버튼을 클릭하세요',
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
      labelKey: 'MESSAGES.SAVE', // [SDUI v1.1] i18n 키 사용 (업종중립 준수)
      label: '저장', // fallback
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

