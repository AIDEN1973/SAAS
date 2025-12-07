/**
 * SchemaTable Component
 * 
 * SDUI v1.1: Table Schema ?Œë”?? * 
 * ê¸°ìˆ ë¬¸ì„œ: SDUI ê¸°ìˆ ë¬¸ì„œ v1.1 - 14. Table Engine
 */

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { DataTable, type DataTableColumn } from '@ui-core/react';
import type { TableSchema } from '../types';
import { executeActionsForEvent, type ActionContext } from '../core/actionEngine';

export interface SchemaTableProps {
  schema: TableSchema;
  className?: string;
  // SDUI v1.1: Action Engine ì»¨í…?¤íŠ¸ (? íƒ??
  actionContext?: Partial<ActionContext>;
  // SDUI v1.1: i18n ë²ˆì—­ (? íƒ??
  translations?: Record<string, string>;
  // API ?¸ì¶œ ?¨ìˆ˜ (? íƒ?? ?†ìœ¼ë©?@api-sdk/core??apiClient ?¬ìš©)
  apiCall?: (endpoint: string, method: string, body?: any) => Promise<any>;
}

/**
 * SchemaTable ì»´í¬?ŒíŠ¸
 * 
 * TableSchemaë¥??Œë”ë§í•©?ˆë‹¤.
 * API ê¸°ë°˜ ?°ì´???ŒìŠ¤, ???¡ì…˜, ë²Œí¬ ?¡ì…˜ ?±ì„ ì§€?í•©?ˆë‹¤.
 */
export const SchemaTable: React.FC<SchemaTableProps> = ({
  schema,
  className,
  actionContext,
  translations = {},
  apiCall,
}) => {
  const { dataSource, columns, rowActions, bulkActions, pagination, selection, virtualization } = schema.table;

  // SDUI v1.1: API ?°ì´???ŒìŠ¤ ë¡œë“œ
  const { data, isLoading, error } = useQuery({
    queryKey: ['schema-table', schema.entity, dataSource.endpoint],
    queryFn: async () => {
      if (dataSource.type !== 'api') {
        throw new Error('Only API data source is supported');
      }

      // ? ï¸ ì¤‘ìš”: Zero-Trust ?ì¹™ - apiCall prop???„ìˆ˜?…ë‹ˆ??
      // apiCall???†ìœ¼ë©?@api-sdk/core??apiClientë¥??¬ìš©?´ì•¼ ?©ë‹ˆ??
      if (!apiCall) {
        // apiCall???†ìœ¼ë©?apiClientë¥??¬ìš©
        const { apiClient } = await import('@api-sdk/core');
        // ? ï¸ ì°¸ê³ : apiClient.get()?€ method ?µì…˜??ì§€?í•˜ì§€ ?Šìœ¼ë¯€ë¡? GETë§??¬ìš©
        // POSTê°€ ?„ìš”??ê²½ìš° apiCall prop???¬ìš©?´ì•¼ ?©ë‹ˆ??
        const res = await apiClient.get(dataSource.endpoint);
        const data = (res as any).data ?? res;
        return data;
      }

      return await apiCall(dataSource.endpoint, dataSource.method || 'GET');
    },
    enabled: !!dataSource.endpoint,
  });

  // SDUI v1.1: DataTable ì»¬ëŸ¼ ë³€??  const dataTableColumns: DataTableColumn[] = React.useMemo(() => {
    return columns.map((col) => ({
      key: col.key,
      label: col.labelKey
        ? (translations[col.labelKey] || col.labelKey)
        : (col.label || col.key),
      width: col.width !== undefined ? (typeof col.width === 'number' ? String(col.width) : col.width) : undefined,
      align: col.type === 'number' ? 'right' : 'left',
      render: (value: any, row: any) => {
        // ?€?…ë³„ ?Œë”ë§?        switch (col.type) {
          case 'date':
            return value ? new Date(value).toLocaleDateString() : '-';
          case 'number':
            return typeof value === 'number' ? value.toLocaleString() : value;
          case 'tag':
          case 'badge':
            return <span>{value}</span>; // TODO: Tag/Badge ì»´í¬?ŒíŠ¸ ?¬ìš©
          default:
            return value ?? '-';
        }
      },
    }));
  }, [columns, translations]);

  // SDUI v1.1: ???´ë¦­ ?¸ë“¤??  const handleRowClick = React.useCallback(async (row: any) => {
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
    return <div className={className}>ë¡œë”© ì¤?..</div>;
  }

  if (error) {
    return <div className={className}>?ëŸ¬: {error instanceof Error ? error.message : String(error)}</div>;
  }

  return (
    <div className={className}>
      <DataTable
        data={data || []}
        columns={dataTableColumns}
        keyExtractor={(row: any) => row.id || row[columns[0]?.key]}
        onRowClick={rowActions && rowActions.length > 0 ? handleRowClick : undefined}
        emptyMessage="?°ì´?°ê? ?†ìŠµ?ˆë‹¤."
      />
      {/* TODO: pagination, selection, bulkActions, virtualization ì§€??*/}
    </div>
  );
};

