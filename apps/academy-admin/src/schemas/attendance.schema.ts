/**
 * Attendance Form Schema
 *
 * [불변 규칙] 스키마 엔진 기반 FormSchema 정의
 * [불변 규칙] Factory Function 패턴으로 업종중립성 지원
 * [동적 옵션] 학생 및 수업 목록은 동적으로 채워집니다.
 */

import type { FormSchema } from '@schema-engine';
import type { Student } from '@services/student-service';
import type { Class } from '@services/class-service';
import type { IndustryTerms } from '@industry/registry';

export function createAttendanceFormSchema(
  students?: Student[],
  classes?: Class[],
  terms?: IndustryTerms
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
            label: terms ? terms.PERSON_LABEL_PRIMARY : '학생',
            colSpan: 1,
          },
          options: [
            { label: '선택', value: '' },
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
            label: terms ? `${terms.GROUP_LABEL} (선택)` : '수업 (선택)',
            colSpan: 1,
          },
          options: [
            { label: '선택 안함', value: '' },
            ...(classes?.map((c) => ({ label: c.name, value: c.id })) || []),
          ],
        },
        {
          name: 'occurred_at',
          kind: 'datetime',
          ui: {
            label: terms ? `${terms.ATTENDANCE_LABEL} 시간` : '출결 시간',
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
            label: terms ? `${terms.ATTENDANCE_LABEL} 유형` : '출결 유형',
            colSpan: 1,
          },
          options: [
            { label: terms ? terms.CHECK_IN_LABEL : '등원', value: 'check_in' },
            { label: terms ? terms.CHECK_OUT_LABEL : '하원', value: 'check_out' },
            { label: terms ? terms.LATE_LABEL : '지각', value: 'late' },
            { label: terms ? terms.ABSENCE_LABEL : '결석', value: 'absent' },
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
            label: '상태',
            colSpan: 1,
          },
          options: [
            { label: terms ? terms.PRESENT_LABEL : '출석', value: 'present' },
            { label: terms ? terms.LATE_LABEL : '지각', value: 'late' },
            { label: terms ? terms.ABSENCE_LABEL : '결석', value: 'absent' },
            { label: terms ? terms.EXCUSED_LABEL : '사유', value: 'excused' },
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
            label: '메모',
            colSpan: 2,
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
          endpoint: 'attendances',
          method: 'POST',
          body: 'form',
        },
        {
          event: 'onSubmitSuccess',
          type: 'toast',
          messageKey: 'ATTENDANCE.SAVE.SUCCESS',
          message: terms ? `${terms.ATTENDANCE_LABEL} 기록이 저장되었습니다.` : '출결 기록이 저장되었습니다.',
          variant: 'success',
        },
        {
          event: 'onSubmitError',
          type: 'toast',
          messageKey: 'ATTENDANCE.SAVE.ERROR',
          message: terms ? `${terms.ATTENDANCE_LABEL} 기록 저장에 실패했습니다.` : '출결 기록 저장에 실패했습니다.',
          variant: 'error',
        },
      ],
    },
  };
}
