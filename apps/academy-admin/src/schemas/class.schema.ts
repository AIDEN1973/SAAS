/**
 * Class Form Schema
 * 
 * [ë¶ˆë? ê·œì¹™] ?¤í‚¤ë§??”ì§„ ê¸°ë°˜ FormSchema ?•ì˜
 */

import type { FormSchema } from '@schema/engine';

export const classFormSchema: FormSchema = {
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
          label: 'ë°??´ë¦„',
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
          label: 'ê³¼ëª©',
          colSpan: 1,
        },
      },
      {
        name: 'grade',
        kind: 'text',
        ui: {
          label: '?€???™ë…„',
          colSpan: 1,
        },
      },
      {
        name: 'day_of_week',
        kind: 'select',
        ui: {
          label: '?”ì¼',
          colSpan: 1,
        },
        options: [
          { label: '?”ìš”??, value: 'monday' },
          { label: '?”ìš”??, value: 'tuesday' },
          { label: '?˜ìš”??, value: 'wednesday' },
          { label: 'ëª©ìš”??, value: 'thursday' },
          { label: 'ê¸ˆìš”??, value: 'friday' },
          { label: '? ìš”??, value: 'saturday' },
          { label: '?¼ìš”??, value: 'sunday' },
        ],
        defaultValue: 'monday',
        validation: {
          required: true,
        },
      },
      {
        name: 'start_time',
        kind: 'text',
        ui: {
          label: '?œì‘ ?œê°„',
          placeholder: '14:00',
          colSpan: 1,
        },
        validation: {
          required: true,
          pattern: {
            value: '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$',
            message: '?œê°„ ?•ì‹???¬ë°”ë¥´ì? ?ŠìŠµ?ˆë‹¤ (?? 14:00)',
          },
        },
      },
      {
        name: 'end_time',
        kind: 'text',
        ui: {
          label: 'ì¢…ë£Œ ?œê°„',
          placeholder: '15:30',
          colSpan: 1,
        },
        validation: {
          required: true,
          pattern: {
            value: '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$',
            message: '?œê°„ ?•ì‹???¬ë°”ë¥´ì? ?ŠìŠµ?ˆë‹¤ (?? 15:30)',
          },
        },
      },
      {
        name: 'capacity',
        kind: 'number',
        ui: {
          label: '?•ì›',
          colSpan: 1,
        },
        validation: {
          required: true,
          min: 1,
        },
        defaultValue: 20,
      },
      {
        name: 'room',
        kind: 'text',
        ui: {
          label: 'ê°•ì˜??,
          colSpan: 1,
        },
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
      label: '?ì„±',
      variant: 'solid',
      color: 'primary',
      size: 'md',
    },
  },
};

