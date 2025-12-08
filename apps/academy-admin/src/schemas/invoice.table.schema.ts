/**
 * Invoice Table Schema
 *
 * [불변 규칙] 스키마 엔진 기반 TableSchema 정의
 */

import type { TableSchema } from '@schema-engine';

export const invoiceTableSchema: TableSchema = {
  version: '1.0.0',
  minSupportedClient: '1.0.0',
  entity: 'invoice',
  type: 'table',
  table: {
    dataSource: {
      type: 'api',
      endpoint: 'invoices',
      method: 'GET',
    },
    columns: [
      {
        key: 'status',
        label: '상태',
        sortable: true,
        type: 'badge',
      },
      {
        key: 'amount',
        label: '금액',
        sortable: true,
        type: 'number',
      },
      {
        key: 'due_date',
        label: '마감일',
        sortable: true,
        type: 'date',
      },
      {
        key: 'created_at',
        label: '생성일',
        sortable: true,
        type: 'date',
      },
    ],
    rowActions: ['view', 'edit'],
    pagination: {
      defaultPageSize: 20,
      pageSizeOptions: [10, 20, 50, 100],
    },
    selection: 'none',
  },
};

