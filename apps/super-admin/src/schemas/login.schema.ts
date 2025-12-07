/**
 * Login Form Schema
 * 
 * [ë¶ˆë? ê·œì¹™] ?¤í‚¤ë§??”ì§„ ê¸°ë°˜ FormSchema ?•ì˜
 * [ë¶ˆë? ê·œì¹™] Tailwind ?´ë˜??ì§ì ‘ ?¬ìš© ê¸ˆì?, props ê¸°ë°˜ ?„ë‹¬
 */

import type { FormSchema } from '@schema/engine';

export const loginFormSchema: FormSchema = {
  version: '1.0.0',
  minSupportedClient: '1.0.0',
  entity: 'login',
  type: 'form',
  form: {
    fields: [
      {
        name: 'email',
        kind: 'email',
        ui: {
          label: '?´ë©”??,
        },
        validation: {
          required: '?´ë©”?¼ì„ ?…ë ¥?´ì£¼?¸ìš”.',
        },
        defaultValue: '',
      },
      {
        name: 'password',
        kind: 'password',
        ui: {
          label: 'ë¹„ë?ë²ˆí˜¸',
        },
        validation: {
          required: 'ë¹„ë?ë²ˆí˜¸ë¥??…ë ¥?´ì£¼?¸ìš”.',
        },
        defaultValue: '',
      },
    ],
    submit: {
      label: 'ë¡œê·¸??,
      variant: 'solid',
      color: 'primary',
      size: 'md',
    },
  },
};

export const otpLoginFormSchema: FormSchema = {
  version: '1.0.0',
  minSupportedClient: '1.0.0',
  entity: 'otp_login',
  type: 'form',
  form: {
    fields: [
      {
        name: 'otp',
        kind: 'text',
        ui: {
          label: 'OTP ì½”ë“œ',
          placeholder: '6?ë¦¬ ì½”ë“œ',
        },
        validation: {
          required: 'OTP ì½”ë“œë¥??…ë ¥?´ì£¼?¸ìš”.',
          minLength: 6,
          maxLength: 6,
        },
        defaultValue: '',
      },
    ],
    submit: {
      label: 'ë¡œê·¸??,
      variant: 'solid',
      color: 'primary',
      size: 'md',
    },
  },
};

