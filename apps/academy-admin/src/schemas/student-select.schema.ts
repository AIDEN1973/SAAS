/**
 * Student Select Form Schema
 *
 * [불변 규칙] 스키마 엔진 기반 FormSchema 정의
 */

import type { FormSchema } from '@schema-engine';

export const studentSelectFormSchema: FormSchema = {
  version: '1.0.0',
  minSupportedClient: '1.0.0',
  entity: 'student_select',
  type: 'form',
  form: {
    layout: {
      columns: 1,
      columnGap: 'md',
      rowGap: 'md',
    },
    fields: [
      {
        name: 'student_id',
        kind: 'select',
        ui: {
          label: '학생 선택',
        },
        // options는 동적으로 로드되어야 하므로 빈 배열로 시작
        options: [],
        validation: {
          required: true,
        },
      },
    ],
  },
};

