/**
 * Subject Revenue Table Schema
 *
 * [불변 규칙] 스키마 엔진 기반 TableSchema 정의
 * [요구사항] 과목별 매출 집계 표시
 */

import type { TableSchema } from '@schema-engine';

export const subjectRevenueTableSchema: TableSchema = {
  version: '1.0.0',
  minSupportedClient: '1.0.0',
  entity: 'subject_revenue',
  type: 'table',
  table: {
    dataSource: {
      type: 'api',
      endpoint: 'invoice_items', // apiClient will handle tenant_id
      method: 'GET',
    },
    columns: [
      {
        key: 'category',
        label: '과목',
        sortable: true,
        type: 'text',
      },
      {
        key: 'total_amount',
        label: '총 매출',
        sortable: true,
        type: 'number',
      },
      {
        key: 'item_count',
        label: '건수',
        sortable: true,
        type: 'number',
      },
    ],
    rowActions: [],
    pagination: {
      defaultPageSize: 10,
      pageSizeOptions: [10, 20, 50],
    },
    selection: 'none',
  },
};

