/**
 * SchemaTable Component
 * 
 * SDUI v1.1: Table Schema 렌더러
 * 
 * 기술문서: SDUI 기술문서 v1.1 - 14. Table Engine
 */

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { DataTable, type DataTableColumn } from '@ui-core/react';
import type { TableSchema } from '../types';
import { executeActionsForEvent, type ActionContext } from '../core/actionEngine';

export interface SchemaTableProps {
  schema: TableSchema;
  className?: string;
  // SDUI v1.1: Action Engine 컨텍스트 (선택적)
  actionContext?: Partial<ActionContext>;
  // SDUI v1.1: i18n 번역 (선택적)
  translations?: Record<string, string>;
  // API 호출 함수 (선택적, 없으면 @api-sdk/core의 apiClient 사용)
  apiCall?: (endpoint: string, method: string, body?: any) => Promise<any>;
}

/**
 * SchemaTable 컴포넌트
 * 
 * TableSchema를 렌더링합니다.
 * API 기반 데이터 소스, 행 액션, 벌크 액션 등을 지원합니다.
 */
export const SchemaTable: React.FC<SchemaTableProps> = ({
  schema,
  className,
  actionContext,
  translations = {},
  apiCall,
}) => {
  const { dataSource, columns, rowActions } = schema.table;

  // SDUI v1.1: API 데이터 소스 로드
  const { data, isLoading, error } = useQuery({
    queryKey: ['schema-table', schema.entity, dataSource.endpoint],
    queryFn: async () => {
      if (dataSource.type !== 'api') {
        throw new Error('Only API data source is supported');
      }

      // ⚠️ 중요: Zero-Trust 원칙 - apiCall prop이 필수입니다.
      // apiCall이 없으면 @api-sdk/core의 apiClient를 사용해야 합니다.
      if (!apiCall) {
        // apiCall이 없으면 apiClient를 사용
        const { apiClient } = await import('@api-sdk/core');
        // ⚠️ 참고: apiClient.get()은 method 옵션을 지원하지 않으므로, GET만 사용
        // POST가 필요한 경우 apiCall prop을 사용해야 합니다.
        const res = await apiClient.get(dataSource.endpoint);
        const data = (res as any).data ?? res;
        return data;
      }

      return await apiCall(dataSource.endpoint, dataSource.method || 'GET');
    },
    enabled: !!dataSource.endpoint,
  });

  // SDUI v1.1: DataTable 컬럼 변환
  const dataTableColumns: DataTableColumn[] = React.useMemo(() => {
    return columns.map((col) => ({
      key: col.key,
      label: col.labelKey
        ? (translations[col.labelKey] || col.labelKey)
        : (col.label || col.key),
      width: col.width !== undefined ? (typeof col.width === 'number' ? String(col.width) : col.width) : undefined,
      align: col.type === 'number' ? 'right' : 'left',
      render: (value: any, _row: any) => {
        // 타입별 렌더링
        switch (col.type) {
          case 'date':
            return value ? new Date(value).toLocaleDateString() : '-';
          case 'number':
            return typeof value === 'number' ? value.toLocaleString() : value;
          case 'tag':
          case 'badge':
            return <span>{value}</span>; // TODO: Tag/Badge 컴포넌트 사용
          default:
            return value ?? '-';
        }
      },
    }));
  }, [columns, translations]);

  // SDUI v1.1: 행 클릭 핸들러
  const handleRowClick = React.useCallback(async (row: any) => {
    if (schema.actions && schema.actions.length > 0) {
      const fullContext: ActionContext = {
        selectedRows: [row],
        translations,
        ...actionContext,
      };
      await executeActionsForEvent('onRowClick', schema.actions, fullContext);
    }
  }, [schema.actions, actionContext, translations]);

  if (isLoading) {
    return <div className={className}>로딩 중...</div>;
  }

  if (error) {
    return <div className={className}>에러: {error instanceof Error ? error.message : String(error)}</div>;
  }

  return (
    <div className={className}>
      <DataTable
        data={data || []}
        columns={dataTableColumns}
        keyExtractor={(row: any) => row.id || row[columns[0]?.key]}
        onRowClick={rowActions && rowActions.length > 0 ? handleRowClick : undefined}
        emptyMessage="데이터가 없습니다."
      />
      {/* TODO: pagination, selection, bulkActions, virtualization 지원 */}
    </div>
  );
};

