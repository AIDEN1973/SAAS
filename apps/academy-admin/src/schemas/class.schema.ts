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
          label: terms ? `${terms.GROUP_LABEL} 이름` : '반 이름',
          colSpan: 2,
        },
        validation: {
          required: true,
        },
      },
      {
        name: 'subject',
        kind: 'text',
        ui: {
          label: terms ? terms.SUBJECT_LABEL : '과목',
          colSpan: 1,
        },
      },
      {
        name: 'grade',
        kind: 'text',
        ui: {
          label: terms ? terms.GRADE_LABEL : '대상 학년',
          colSpan: 1,
        },
      },
      {
        name: 'day_of_week',
        kind: 'select',
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
        defaultValue: 'monday',
        // 아키텍처 문서 M5: 반 이름만 입력해도 생성 가능, 시간·요일·정원은 고급 옵션
      },
      {
        name: 'start_time',
        kind: 'text',
        ui: {
          label: '시작 시간',
          placeholder: '14:00',
          colSpan: 1,
        },
        defaultValue: '14:00',
        validation: {
          // 아키텍처 문서 M5: 반 이름만 입력해도 생성 가능
          pattern: {
            value: '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$',
            message: '시간 형식이 올바르지 않습니다 (예: 14:00)',
          },
        },
      },
      {
        name: 'end_time',
        kind: 'text',
        ui: {
          label: '종료 시간',
          placeholder: '15:30',
          colSpan: 1,
        },
        defaultValue: '15:30',
        validation: {
          // 아키텍처 문서 M5: 반 이름만 입력해도 생성 가능
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
          colSpan: 1,
        },
        defaultValue: 20,
        validation: {
          // 아키텍처 문서 M5: 반 이름만 입력해도 생성 가능
          min: 1,
        },
      },
      {
        name: 'room',
        kind: 'text',
        ui: {
          label: terms ? terms.ROOM_LABEL : '강의실',
          colSpan: 1,
        },
      },
      {
        name: 'color',
        kind: 'text',
        ui: {
          label: terms ? `${terms.GROUP_LABEL} 색상` : '반 색상',
          colSpan: 1,
          placeholder: '#3b82f6',
          description: '자동 할당됩니다. 원하는 색상으로 변경 가능합니다.',
        },
        validation: {
          pattern: {
            value: '^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$',
            message: '올바른 색상 코드를 입력하세요 (예: #3b82f6)',
          },
        },
      },
      {
        name: 'teacher_ids',
        kind: 'multiselect',
        ui: {
          label: terms ? `${terms.PERSON_LABEL_SECONDARY} 배정` : '강사 배정',
          colSpan: 1,
        },
        options: [
          ...(teachers?.map((t) => ({ label: t.name, value: t.id })) || []),
        ],
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
    // SDUI v1.1: Action Engine 지원
    actions: [
      {
        event: 'onSubmit',
        type: 'api.call',
        endpoint: 'classes',
        method: 'POST',
        body: 'form',
      },
      {
        event: 'onSubmitSuccess',
        type: 'toast',
        messageKey: 'CLASS.CREATE.SUCCESS',
        message: terms ? `${terms.GROUP_LABEL}이 생성되었습니다.` : '반이 생성되었습니다.',
        variant: 'success',
      },
      {
        event: 'onSubmitError',
        type: 'toast',
        messageKey: 'CLASS.CREATE.ERROR',
        message: terms ? `${terms.GROUP_LABEL} 생성에 실패했습니다.` : '반 생성에 실패했습니다.',
        variant: 'error',
      },
    ],
    },
  };
}

