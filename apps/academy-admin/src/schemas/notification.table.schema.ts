/**
 * Notification Table Schema
 *
 * [불변 규칙] 스키마 엔진 기반 TableSchema 정의
 */

import type { TableSchema } from '@schema-engine';

export const notificationTableSchema: TableSchema = {
  version: '1.0.0',
  minSupportedClient: '1.0.0',
  entity: 'notification',
  type: 'table',
  table: {
    dataSource: {
      type: 'api',
      endpoint: 'notifications',
      method: 'GET',
    },
    columns: [
      {
        key: 'channel',
        label: '채널',
        sortable: true,
        type: 'badge',
      },
      {
        key: 'recipient',
        label: '수신자',
        sortable: true,
        type: 'text',
      },
      {
        key: 'content',
        label: '내용',
        type: 'text',
      },
      {
        key: 'sent_at',
        label: '발송일시',
        sortable: true,
        type: 'date',
      },
      {
        key: 'status',
        label: '상태',
        sortable: true,
        type: 'badge',
      },
    ],
    rowActions: ['view'],
    pagination: {
      defaultPageSize: 20,
      pageSizeOptions: [10, 20, 50, 100],
    },
    selection: 'none',
  },
};

