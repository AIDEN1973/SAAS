/**
 * Attendance Settings Form Schema
 *
 * [불변 규칙] 스키마 엔진 기반 FormSchema 정의
 */

import type { FormSchema } from '@schema-engine';

export const attendanceSettingsFormSchema: FormSchema = {
  version: '1.0.0',
  minSupportedClient: '1.0.0',
  entity: 'attendance_settings',
  type: 'form',
  form: {
    layout: {
      columns: 1,
      columnGap: 'md',
      rowGap: 'md',
    },
    fields: [
      {
        name: 'late_after',
        kind: 'number',
        ui: {
          label: '지각 기준 (분)',
          description: '수업 시작 시간으로부터 지각으로 처리할 기준 시간(분)입니다.',
        },
        validation: {
          required: true,
          min: 0,
        },
      },
      {
        name: 'absent_after',
        kind: 'number',
        ui: {
          label: '결석 기준 (분)',
          description: '수업 시작 시간으로부터 결석으로 처리할 기준 시간(분)입니다.',
        },
        validation: {
          required: true,
          min: 0,
        },
      },
      {
        name: 'auto_notification',
        kind: 'checkbox',
        ui: {
          label: '자동 출결 알림 발송',
          description: '출결 기록 시 자동으로 학부모에게 알림을 발송합니다.',
        },
      },
      {
        name: 'notification_channel',
        kind: 'select',
        ui: {
          label: '기본 알림 채널',
        },
        options: [
          { value: 'sms', label: 'SMS' },
          { value: 'kakao', label: '카카오톡' },
        ],
        validation: {
          required: true,
        },
        condition: {
          field: 'auto_notification',
          op: 'eq',
          value: true,
        },
      },
    ],
    submit: {
      labelKey: 'ATTENDANCE_SETTINGS.FORM.SUBMIT',
      label: '저장',
      variant: 'solid',
      color: 'primary',
      size: 'md',
    },
    // SDUI v1.1: Action Engine 지원
    actions: [
      {
        event: 'onSubmit',
        type: 'api.call',
        endpoint: 'attendance-settings',
        method: 'POST',
        body: 'form',
      },
      {
        event: 'onSubmitSuccess',
        type: 'toast',
        messageKey: 'ATTENDANCE_SETTINGS.SAVE.SUCCESS',
        message: '출결 설정이 저장되었습니다.',
        variant: 'success',
      },
      {
        event: 'onSubmitError',
        type: 'toast',
        messageKey: 'ATTENDANCE_SETTINGS.SAVE.ERROR',
        message: '출결 설정 저장에 실패했습니다.',
        variant: 'error',
      },
    ],
  },
};

