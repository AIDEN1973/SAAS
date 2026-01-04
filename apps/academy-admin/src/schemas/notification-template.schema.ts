/**
 * Notification Template Form Schema
 *
 * [불변 규칙] 스키마 엔진 기반 FormSchema 정의
 */

import type { FormSchema } from '@schema-engine';

export const notificationTemplateFormSchema: FormSchema = {
  version: '1.0.0',
  minSupportedClient: '1.0.0',
  entity: 'notification_template',
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
          label: '템플릿명',
          placeholder: '템플릿명을 입력하세요',
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
          placeholder: '템플릿 내용을 입력하세요. 변수는 {{변수명}} 형식으로 사용하세요.\n\n알림톡으로 발송되며, 알림톡 발송 실패 시 자동으로 SMS로 폴백됩니다.',
          colSpan: 2,
        },
        validation: {
          required: true,
        },
      },
    ],
    submit: {
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
        endpoint: 'notification_templates',
        method: 'POST',
        body: 'form',
      },
      {
        event: 'onSubmitSuccess',
        type: 'toast',
        messageKey: 'NOTIFICATION_TEMPLATE.SAVE.SUCCESS',
        message: '템플릿이 저장되었습니다.',
        variant: 'success',
      },
      {
        event: 'onSubmitError',
        type: 'toast',
        messageKey: 'NOTIFICATION_TEMPLATE.SAVE.ERROR',
        message: '템플릿 저장에 실패했습니다.',
        variant: 'error',
      },
    ],
  },
};

