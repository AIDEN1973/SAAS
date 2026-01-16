/**
 * Consultation Table Schema
 *
 * [불변 규칙] 스키마 엔진 기반 TableSchema 정의
 * 전체 학생의 상담 내역을 테이블 형태로 표시
 */

import type { TableSchema } from '@schema-engine';

export const consultationTableSchema: TableSchema = {
  version: '1.0.0',
  minSupportedClient: '1.0.0',
  entity: 'consultation',
  type: 'table',
  table: {
    dataSource: {
      type: 'api',
      endpoint: 'student_consultations',
      method: 'GET',
    },
    columns: [
      {
        key: 'student_name',
        label: '학생명',
        width: 120,
        sortable: true,
        type: 'text',
      },
      {
        key: 'consultation_date',
        label: '상담일',
        width: 120,
        sortable: true,
        type: 'date',
      },
      {
        key: 'consultation_type',
        label: '상담 구분',
        width: 120,
        sortable: true,
        type: 'badge',
        badge_config: {
          counseling: { color: 'info', label: '상담일지' },      // blue → info (표준 토큰)
          learning: { color: 'success', label: '학습일지' },    // green → success (표준 토큰)
          behavior: { color: 'warning', label: '행동일지' },   // yellow → warning (표준 토큰)
          other: { color: 'gray', label: '기타' },             // gray 유지 (확장 색상)
        },
      },
      {
        key: 'content',
        label: '내용',
        width: 300,
        sortable: false,
        type: 'text',
      },
      {
        key: 'created_at',
        label: '등록일시',
        width: 180,
        sortable: true,
        type: 'datetime',
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
