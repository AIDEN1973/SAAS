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
        key: 'status',
        label: '상태',
        sortable: true,
        type: 'badge',
      },
      {
        key: 'phone',
        label: '전화번호',
        type: 'text',
      },
      {
        key: 'email',
        label: '이메일',
        type: 'text',
      },
    ],
    rowActions: ['view', 'edit', 'delete'],
    pagination: {
      defaultPageSize: 20,
      pageSizeOptions: [10, 20, 50, 100],
    },
    selection: 'multiple',
  },
};

