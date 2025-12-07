/**
 * Student Form Schema
 * 
 * [ë¶ˆë? ê·œì¹™] ?¤í‚¤ë§??”ì§„ ê¸°ë°˜ FormSchema ?•ì˜
 * [ë¶ˆë? ê·œì¹™] Tailwind ?´ë˜??ì§ì ‘ ?¬ìš© ê¸ˆì?, props ê¸°ë°˜ ?„ë‹¬
 */

import type { FormSchema } from '@schema/engine';

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
          label: '?´ë¦„',
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
          label: '?ë…„?”ì¼',
          colSpan: 1,
        },
      },
      {
        name: 'gender',
        kind: 'select',
        ui: {
          label: '?±ë³„',
          colSpan: 1,
        },
        options: [
          { label: '? íƒ', value: '' },
          { label: '??, value: 'male' },
          { label: '??, value: 'female' },
        ],
      },
      {
        name: 'phone',
        kind: 'phone',
        ui: {
          label: '?„í™”ë²ˆí˜¸',
          colSpan: 1,
        },
      },
      {
        name: 'email',
        kind: 'email',
        ui: {
          label: '?´ë©”??,
          colSpan: 1,
        },
      },
      {
        name: 'address',
        kind: 'text',
        ui: {
          label: 'ì£¼ì†Œ',
          colSpan: 2,
        },
      },
      {
        name: 'school_name',
        kind: 'text',
        ui: {
          label: '?™êµ',
          colSpan: 1,
        },
      },
      {
        name: 'grade',
        kind: 'text',
        ui: {
          label: '?™ë…„',
          colSpan: 1,
        },
      },
      {
        name: 'status',
        kind: 'select',
        ui: {
          label: '?íƒœ',
          colSpan: 1,
        },
        options: [
          { label: '?¬ì›', value: 'active' },
          { label: '?´ì›', value: 'on_leave' },
          { label: '?´ì›', value: 'withdrawn' },
          { label: 'ì¡¸ì—…', value: 'graduated' },
        ],
        defaultValue: 'active',
      },
      {
        name: 'notes',
        kind: 'textarea',
        ui: {
          label: 'ë¹„ê³ ',
          colSpan: 2,
        },
      },
    ],
    submit: {
      label: '?±ë¡',
      variant: 'solid',
      color: 'primary',
      size: 'md',
    },
  },
};

