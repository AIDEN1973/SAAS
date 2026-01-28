/**
 * Class Form Schema
 *
 * [불변 규칙] 스키마 엔진 기반 FormSchema 정의
 * [동적 옵션] 강사 목록은 동적으로 채워집니다.
 * [업종중립성] IndustryTerms를 받아 동적으로 라벨 생성
 */

import type { FormSchema } from '@schema-engine';
import type { Teacher } from '@services/class-service';
import type { IndustryTerms } from '@industry/registry';

export function createClassFormSchema(teachers?: Teacher[], terms?: IndustryTerms): FormSchema {
  return {
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
          label: terms ? `${terms.GROUP_LABEL}명` : '수업명',
          colSpan: 2,
        },
        validation: {
          required: true,
        },
      },
      {
        name: 'subject',
        kind: 'select',
        ui: {
          label: terms ? terms.SUBJECT_LABEL : '과목',
          colSpan: 1,
        },
        options: [
          { label: '선택', value: '' },
          { label: '국어', value: '국어' },
          { label: '영어', value: '영어' },
          { label: '수학', value: '수학' },
          { label: '과학', value: '과학' },
          { label: '직접입력', value: '__custom__' },
        ],
      },
      {
        name: 'subject_custom',
        kind: 'text',
        ui: {
          label: '과목명 직접입력',
          colSpan: 1,
          placeholder: '과목명을 입력하세요',
        },
        condition: {
          field: 'subject',
          op: '!=',
          value: '__custom__',
          action: 'disable',
        },
      },
      {
        name: 'grade',
        kind: 'multiselect',
        ui: {
          label: terms ? terms.GRADE_LABEL : '대상 학년',
          colSpan: 1,
        },
        options: [
          { label: '4세', value: '4세' },
          { label: '5세', value: '5세' },
          { label: '6세', value: '6세' },
          { label: '7세', value: '7세', divider: true },
          { label: '초등 1학년', value: '초등 1학년' },
          { label: '초등 2학년', value: '초등 2학년' },
          { label: '초등 3학년', value: '초등 3학년' },
          { label: '초등 4학년', value: '초등 4학년' },
          { label: '초등 5학년', value: '초등 5학년' },
          { label: '초등 6학년', value: '초등 6학년', divider: true },
          { label: '중등 1학년', value: '중등 1학년' },
          { label: '중등 2학년', value: '중등 2학년' },
          { label: '중등 3학년', value: '중등 3학년', divider: true },
          { label: '고등 1학년', value: '고등 1학년' },
          { label: '고등 2학년', value: '고등 2학년' },
          { label: '고등 3학년', value: '고등 3학년', divider: true },
          { label: '기타', value: '기타' },
        ],
      },
      {
        name: 'day_of_week',
        kind: 'multiselect',
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
        // 아키텍처 문서 M5: 수업 이름만 입력해도 생성 가능, 시간·요일·정원은 고급 옵션
      },
      {
        name: 'start_time',
        kind: 'time',
        ui: {
          label: '시작 시간',
          placeholder: '시작 시간 (예: 14:00)',
          colSpan: 1,
          description: '시:분 형식으로 입력하세요 (예: 14:00)',
        },
        validation: {
          pattern: {
            value: '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$',
            message: '시간 형식이 올바르지 않습니다 (예: 14:00)',
          },
        },
      },
      {
        name: 'end_time',
        kind: 'time',
        ui: {
          label: '종료 시간',
          placeholder: '종료 시간 (예: 15:00)',
          colSpan: 1,
          description: '시:분 형식으로 입력하세요 (예: 15:30)',
        },
        validation: {
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
          label: terms ? terms.CAPACITY_LABEL : '정원',
          placeholder: '정원',
          colSpan: 1,
          unit: '명',
        },
        validation: {
          // 아키텍처 문서 M5: 수업 이름만 입력해도 생성 가능
          min: 1,
        },
      },
      {
        name: 'teacher_ids',
        kind: 'multiselect',
        ui: {
          label: terms ? `담당 ${terms.PERSON_LABEL_SECONDARY}` : '담당 선생님',
          colSpan: 1,
        },
        options: [
          // class_teachers.teacher_id는 academy_teachers.id를 참조 (수정됨 2026-01-27)
          ...(teachers?.map((t) => ({ label: t.name, value: t.id })) || []),
        ],
      },
      {
        name: 'status',
        kind: 'select',
        ui: {
          label: '운영 상태',
          colSpan: 1,
        },
        options: [
          { label: '운영 중', value: 'active' },
          { label: '중단', value: 'inactive' },
        ],
        defaultValue: 'active',
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
      label: '생성',
      variant: 'solid',
      color: 'primary',
      size: 'md',
    },
    // Note: onSubmit 액션은 ClassesPage의 handleCreateClass/handleUpdateClass Hook으로 처리됨
    // RPC 함수를 통한 트랜잭션 처리 필요 (강사 배정 포함)
    },
  };
}

