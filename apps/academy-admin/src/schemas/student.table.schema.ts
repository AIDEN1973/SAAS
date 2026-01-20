/**
 * Student Table Schema
 *
 * [불변 규칙] 스키마 엔진 기반 TableSchema 정의
 */

import type { TableSchema } from '@schema-engine';

export const studentTableSchema: TableSchema = {
  version: '1.0.0',
  minSupportedClient: '1.0.0',
  entity: 'student',
  type: 'table',
  table: {
    dataSource: {
      type: 'api',
      endpoint: 'students',
      method: 'GET',
    },
    columns: [
      {
        key: 'name',
        label: '이름',
        sortable: true,
        type: 'text',
      },
      {
        key: 'grade',
        label: '학년',
        sortable: true,
        type: 'text',
      },
      {
        key: 'primary_class_name',
        label: '수업',
        sortable: false,
        type: 'text',
      },
      {
        key: 'phone',
        label: '연락처',
        sortable: false,
        type: 'text',
      },
      {
        key: 'attendance_number',
        label: '출결번호',
        sortable: true,
        type: 'text',
      },
      {
        key: 'status',
        label: '상태',
        sortable: true,
        type: 'badge',
        // 아키텍처 문서 5045줄: badge_config 사용 (snake_case)
        badge_config: {
          active: { color: 'green', label: '재원' },
          on_leave: { color: 'yellow', label: '휴원' },
          withdrawn: { color: 'gray', label: '퇴원' },
          graduated: { color: 'blue', label: '졸업' },
        },
      },
    ],
    rowActions: ['view', 'edit', 'delete'],
    pagination: {
      defaultPageSize: 10,
      pageSizeOptions: [10, 20, 50, 100],
    },
    selection: 'multiple',
  },
};

