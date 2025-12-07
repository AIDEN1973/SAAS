/**
 * Attendance Form Schema
 * 
 * [ë¶ˆë? ê·œì¹™] ?¤í‚¤ë§??”ì§„ ê¸°ë°˜ FormSchema ?•ì˜
 * [?™ì  ?µì…˜] ?™ìƒ ë°?ë°?ëª©ë¡?€ ?™ì ?¼ë¡œ ì±„ì›Œì§‘ë‹ˆ??
 */

import type { FormSchema } from '@schema/engine';
import type { Student } from '@services/student-service';
import type { Class } from '@services/class-service';

export function createAttendanceFormSchema(
  students?: Student[],
  classes?: Class[]
): FormSchema {
  return {
    version: '1.0.0',
    minSupportedClient: '1.0.0',
    entity: 'attendance',
    type: 'form',
    form: {
      layout: {
        columns: 2,
        columnGap: 'md',
        rowGap: 'md',
      },
      fields: [
        {
          name: 'student_id',
          kind: 'select',
          ui: {
            label: '?™ìƒ',
            colSpan: 1,
          },
          options: [
            { label: '? íƒ', value: '' },
            ...(students?.map((s) => ({ label: s.name, value: s.id })) || []),
          ],
          validation: {
            required: true,
          },
        },
        {
          name: 'class_id',
          kind: 'select',
          ui: {
            label: 'ë°?(? íƒ)',
            colSpan: 1,
          },
          options: [
            { label: '? íƒ ?ˆí•¨', value: '' },
            ...(classes?.map((c) => ({ label: c.name, value: c.id })) || []),
          ],
        },
        {
          name: 'occurred_at',
          kind: 'datetime',
          ui: {
            label: 'ì¶œê²° ?œê°„',
            colSpan: 1,
          },
          validation: {
            required: true,
          },
        },
        {
          name: 'attendance_type',
          kind: 'select',
          ui: {
            label: 'ì¶œê²° ? í˜•',
            colSpan: 1,
          },
          options: [
            { label: '?±ì›', value: 'check_in' },
            { label: '?˜ì›', value: 'check_out' },
            { label: 'ì§€ê°?, value: 'late' },
            { label: 'ê²°ì„', value: 'absent' },
          ],
          defaultValue: 'check_in',
          validation: {
            required: true,
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
            { label: 'ì¶œì„', value: 'present' },
            { label: 'ì§€ê°?, value: 'late' },
            { label: 'ê²°ì„', value: 'absent' },
            { label: '?¬ìœ ', value: 'excused' },
          ],
          defaultValue: 'present',
          validation: {
            required: true,
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
        label: '?€??,
        variant: 'solid',
        color: 'primary',
        size: 'md',
      },
    },
  };
}

