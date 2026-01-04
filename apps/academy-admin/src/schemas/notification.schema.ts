/**
 * Notification Form Schema
 *
 * [불변 규칙] 스키마 엔진 기반 FormSchema 정의
 * [불변 규칙] Tailwind 클래스 직접 사용 금지, props 기반 전달
 */

import type { FormSchema } from '@schema-engine';

export const notificationFormSchema: FormSchema = {
  version: '1.0.0',
  minSupportedClient: '1.0.0',
  entity: 'notification',
  type: 'form',
  form: {
    layout: {
      columns: 2,
      columnGap: 'md',
      rowGap: 'md',
    },
    fields: [
      // [불변 규칙] 채널 선택 제거됨 - 알림톡 기본, SMS는 폴백으로만 작동
      {
        name: 'recipient',
        kind: 'text',
        ui: {
          label: '수신자',
          placeholder: '전화번호를 입력하세요',
          colSpan: 1,
        },
        validation: {
          required: true,
        },
      },
      {
        name: 'content',
        kind: 'textarea',
        ui: {
          label: '내용',
          placeholder: '메시지 내용을 입력하세요',
          colSpan: 2,
        },
        validation: {
          required: true,
          minLength: 1,
        },
      },
    ],
    submit: {
      label: '발송',
      variant: 'solid',
      color: 'primary',
      size: 'md',
    },
    // SDUI v1.1: Action Engine 지원
    actions: [
      {
        event: 'onSubmit',
        type: 'api.call',
        endpoint: 'notifications',
        method: 'POST',
        body: 'form',
      },
      {
        event: 'onSubmitSuccess',
        type: 'toast',
        messageKey: 'NOTIFICATION.SEND.SUCCESS',
        message: '메시지가 발송되었습니다.',
        variant: 'success',
      },
      {
        event: 'onSubmitError',
        type: 'toast',
        messageKey: 'NOTIFICATION.SEND.ERROR',
        message: '메시지 발송에 실패했습니다.',
        variant: 'error',
      },
    ],
  },
};

