/**
 * Auto Notification Settings Form Schema
 *
 * [불변 규칙] 스키마 엔진 기반 FormSchema 정의
 * [요구사항] 자동 알림 설정 (등원/하원, 청구 생성, 미납 알림)
 */

import type { FormSchema } from '@schema-engine';

export const autoNotificationSettingsFormSchema: FormSchema = {
  version: '1.0.0',
  minSupportedClient: '1.0.0',
  entity: 'auto_notification_settings',
  type: 'form',
  form: {
    layout: {
      columns: 2,
      columnGap: 'md',
      rowGap: 'md',
    },
    fields: [
      {
        name: 'check_in_notification',
        kind: 'checkbox',
        ui: {
          label: '등원 알림 발송',
          description: '학생 등원 시 학부모에게 자동으로 알림을 발송합니다.',
          colSpan: 1,
        },
      },
      {
        name: 'check_out_notification',
        kind: 'checkbox',
        ui: {
          label: '하원 알림 발송',
          description: '학생 하원 시 학부모에게 자동으로 알림을 발송합니다.',
          colSpan: 1,
        },
      },
      {
        name: 'invoice_created_notification',
        kind: 'checkbox',
        ui: {
          label: '청구 생성 알림 발송',
          description: '청구서 생성 시 학부모에게 자동으로 알림을 발송합니다.',
          colSpan: 1,
        },
      },
      {
        name: 'overdue_notification',
        kind: 'checkbox',
        ui: {
          label: '미납 알림 발송',
          description: '미납 발생 시 학부모에게 자동으로 알림을 발송합니다.',
          colSpan: 1,
        },
      },
      {
        name: 'notification_channel',
        kind: 'select',
        ui: {
          label: '기본 알림 채널',
          colSpan: 1,
        },
        options: [
          { value: 'sms', label: 'SMS' },
          { value: 'kakao', label: '카카오 알림톡' },
          { value: 'email', label: '이메일' },
          { value: 'push', label: '푸시 알림' },
        ],
        validation: {
          required: true,
        },
        defaultValue: 'sms',
      },
    ],
    submit: {
      labelKey: 'AUTO_NOTIFICATION_SETTINGS.FORM.SUBMIT',
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
        endpoint: 'notification-settings/auto',
        method: 'POST',
        body: 'form',
      },
      {
        event: 'onSubmitSuccess',
        type: 'toast',
        messageKey: 'AUTO_NOTIFICATION_SETTINGS.SAVE.SUCCESS',
        message: '자동 알림 설정이 저장되었습니다.',
        variant: 'success',
      },
      {
        event: 'onSubmitError',
        type: 'toast',
        messageKey: 'AUTO_NOTIFICATION_SETTINGS.SAVE.ERROR',
        message: '자동 알림 설정 저장에 실패했습니다.',
        variant: 'error',
      },
    ],
  },
};

