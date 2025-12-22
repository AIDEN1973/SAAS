/**
 * Bulk Notification Form Schema
 *
 * [불변 규칙] 스키마 엔진 기반 FormSchema 정의
 */

import type { FormSchema } from '@schema-engine';

export const bulkNotificationFormSchema: FormSchema = {
  version: '1.0.0',
  minSupportedClient: '1.0.0',
  entity: 'bulk_notification',
  type: 'form',
  form: {
    layout: {
      columns: 2,
      columnGap: 'md',
      rowGap: 'md',
    },
    fields: [
      {
        name: 'channel',
        kind: 'select',
        ui: {
          label: '채널',
          colSpan: 1,
        },
        options: [
          { value: 'sms', label: 'SMS' },
          { value: 'kakao_at', label: '카카오 알림톡' },  // SSOT-3: 저장/실행용 코드는 'kakao_at', UI 표시명은 '카카오 알림톡'
        ],
        validation: {
          required: true,
        },
      },
      {
        name: 'scheduled_at',
        kind: 'datetime',
        ui: {
          label: '예약 발송 시간',
          description: '즉시 발송하려면 비워두세요',
          colSpan: 1,
        },
      },
      {
        name: 'recipients',
        kind: 'textarea',
        ui: {
          label: '수신자 목록',
          placeholder: '전화번호를 한 줄에 하나씩 입력하세요',
          description: '각 수신자를 한 줄에 하나씩 입력하세요',
          colSpan: 2,
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
        endpoint: 'notifications/bulk',
        method: 'POST',
        body: 'form',
      },
      {
        event: 'onSubmitSuccess',
        type: 'toast',
        messageKey: 'BULK_NOTIFICATION.SEND.SUCCESS',
        message: '단체 메시지가 발송되었습니다.',
        variant: 'success',
      },
      {
        event: 'onSubmitError',
        type: 'toast',
        messageKey: 'BULK_NOTIFICATION.SEND.ERROR',
        message: '단체 메시지 발송에 실패했습니다.',
        variant: 'error',
      },
    ],
  },
};

