/**
 * Signup Form Schema
 * 
 * [ë¶ˆë? ê·œì¹™] ?¤í‚¤ë§??”ì§„ ê¸°ë°˜ FormSchema ?•ì˜
 * [ë¶ˆë? ê·œì¹™] Tailwind ?´ë˜??ì§ì ‘ ?¬ìš© ê¸ˆì?, props ê¸°ë°˜ ?„ë‹¬
 */

import type { FormSchema } from '@schema/engine';
import type { IndustryType } from '@core/tenancy';

export const signupFormSchema: FormSchema = {
  version: '1.0.0',
  minSupportedClient: '1.0.0',
  entity: 'signup',
  type: 'form',
  form: {
    layout: {
      columns: 1,
      columnGap: 'md',
      rowGap: 'md',
    },
    fields: [
      // ?¬ìš©???•ë³´ ?¹ì…˜
      {
        name: 'name',
        kind: 'text',
        ui: {
          label: '?´ë¦„',
        },
        validation: {
          required: '?´ë¦„???…ë ¥?´ì£¼?¸ìš”.',
        },
        defaultValue: '',
      },
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
        name: 'phone',
        kind: 'phone',
        ui: {
          label: '?„í™”ë²ˆí˜¸ (? íƒ)',
          placeholder: '010-1234-5678',
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
          minLength: 8,
        },
        defaultValue: '',
      },
      {
        name: 'passwordConfirm',
        kind: 'password',
        ui: {
          label: 'ë¹„ë?ë²ˆí˜¸ ?•ì¸',
        },
        validation: {
          required: 'ë¹„ë?ë²ˆí˜¸ ?•ì¸???…ë ¥?´ì£¼?¸ìš”.',
          // ? ï¸ ì°¸ê³ : validate ?¨ìˆ˜??Schema Registry(JSONB)???€?¥ë  ???†ê³ ,
          // formValuesë¥?ë°›ì„ ???†ìœ¼ë¯€ë¡? ë¹„ë?ë²ˆí˜¸ ?•ì¸?€ ?´ë¼?´ì–¸??ì¸¡ì—??ë³„ë„ë¡?ì²˜ë¦¬?´ì•¼ ?©ë‹ˆ??
          // validate: (value: any) => boolean | string;  // ?¨ì¼ valueë§?ë°›ì„ ???ˆìŒ
        },
        defaultValue: '',
      },
      // ?Œë„Œ???•ë³´ ?¹ì…˜
      {
        name: 'tenantName',
        kind: 'text',
        ui: {
          label: '?Œë„Œ???´ë¦„',
          placeholder: '?? ?œìš¸ ?™ì›',
        },
        validation: {
          required: '?Œë„Œ???´ë¦„???…ë ¥?´ì£¼?¸ìš”.',
        },
        defaultValue: '',
      },
      {
        name: 'industryType',
        kind: 'select',
        ui: {
          label: '?…ì¢…',
        },
        options: [
          { label: '?™ì›', value: 'academy' },
          { label: 'ë¯¸ìš©??, value: 'salon' },
          { label: 'ë¶€?™ì‚°', value: 'realestate' },
          { label: '?¬ìŠ¤??, value: 'gym' },
          { label: 'ë¹„ì˜ë¦¬ë‹¨ì²?, value: 'ngo' },
        ],
        validation: {
          required: '?…ì¢…??? íƒ?´ì£¼?¸ìš”.',
        },
        defaultValue: 'academy',
      },
    ],
    submit: {
      label: '?Œì›ê°€??,
      variant: 'solid',
      color: 'primary',
      size: 'md',
    },
  },
};

