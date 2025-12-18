/**
 * SchemaTable Component
 *
 * SDUI v1.1: Table Schema 렌더러
 *
 * 기술문서: SDUI 기술문서 v1.1 - 14. Table Engine
 */

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { DataTable, type DataTableColumn, Pagination } from '@ui-core/react';
import { toKST } from '@lib/date-utils'; // 기술문서 5-2: KST 변환 필수
import type { TableSchema } from '../types';
import { executeActionsForEvent, executeAction, type ActionContext } from '../core/actionEngine';

export interface SchemaTableProps {
  schema: TableSchema;
  className?: string;
  // SDUI v1.1: Action Engine 컨텍스트 (선택적)
  actionContext?: Partial<ActionContext>;
  // SDUI v1.1: i18n 번역 (선택적)
  translations?: Record<string, string>;
  // 외부에서 데이터를 주입하는 경우 (API 호출을 건너뜀)
  data?: Record<string, unknown>[];
  /**
   * 서버 페이지네이션 모드에서 전체 건수
   * - data는 "현재 페이지 데이터"만 주입
   */
  totalCount?: number;
  /** 서버 페이지네이션 모드에서 현재 페이지(1-base) */
  page?: number;
  /** 서버 페이지네이션 모드에서 페이지 변경 콜백 */
  onPageChange?: (page: number) => void;
  // API 호출 함수 (선택적, 없으면 @api-sdk/core의 apiClient 사용)
  apiCall?: (endpoint: string, method: string, body?: unknown) => Promise<unknown>;
  // SDUI v1.1: 필터 파라미터 (선택적)
  filters?: Record<string, unknown>;
  // 행 클릭 핸들러 (선택적, schema.actions보다 우선순위 높음)
  onRowClick?: (row: Record<string, unknown>) => void;
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
  data: injectedData,
  totalCount,
  page,
  onPageChange,
  apiCall,
  filters,
  onRowClick,
}) => {
  const { dataSource, columns, rowActions, rowActionHandlers, pagination: paginationConfig } = schema.table;

  // 페이지네이션 상태 관리
  const [currentPage, setCurrentPage] = React.useState(1);
  const itemsPerPage = paginationConfig?.defaultPageSize || paginationConfig?.pageSize || 10;
  const effectivePage = page ?? currentPage;

  // 필터 변경 시 첫 페이지로 리셋
  React.useEffect(() => {
    setCurrentPage(1);
    onPageChange?.(1);
  }, [filters, onPageChange]);

  // SDUI v1.1: API 데이터 소스 로드 (data가 주입되면 스킵)
  const { data, isLoading, error } = useQuery({
    queryKey: ['schema-table', schema.entity, dataSource.endpoint, filters],
    queryFn: async () => {
      if (dataSource.type !== 'api') {
        throw new Error('Only API data source is supported');
      }

      // ⚠️ 중요: Zero-Trust 원칙
      // - 외부에서 data를 주입하는 경우: 네트워크 호출이 없으므로 예외(이 컴포넌트는 렌더러 역할만 수행)
      // - API 데이터 소스를 직접 호출하는 경우: apiCall prop 사용을 권장하며, 없으면 @api-sdk/core의 apiClient(GET)로 fallback
      if (!apiCall) {
        // apiCall이 없으면 apiClient를 사용
        const { apiClient } = await import('@api-sdk/core');
        // ⚠️ 참고: apiClient.get()은 method 옵션을 지원하지 않으므로, GET만 사용
        // POST가 필요한 경우 apiCall prop을 사용해야 합니다.
        const res = await apiClient.get(dataSource.endpoint, {
          filters: filters,
          orderBy: { column: 'created_at', ascending: false },
        });
        const result = res as { data?: unknown[] } | unknown[];
        const data = (result && typeof result === 'object' && 'data' in result) ? (result as { data?: unknown[] }).data ?? result : (Array.isArray(result) ? result : []);
        return data;
      }

      return await apiCall(dataSource.endpoint, dataSource.method || 'GET');
    },
    enabled: !!dataSource.endpoint && !injectedData,
  });

  // SDUI v1.1: DataTable 컬럼 변환
  const dataTableColumns: DataTableColumn[] = React.useMemo(() => {
    const baseColumns = columns.map((col) => ({
      key: col.key,
      label: col.labelKey
        ? (translations[col.labelKey] || col.labelKey)
        : (col.label || col.key),
      width: col.width !== undefined ? (typeof col.width === 'number' ? String(col.width) : col.width) : undefined,
      align: 'center' as 'left' | 'right' | 'center',
      render: (_value: unknown, _row: unknown) => {
        // 타입별 렌더링
        switch (col.type) {
          case 'date':
            // 기술문서 5-2: KST 변환 필수
            return _value ? toKST(_value as string | number | Date).format('YYYY-MM-DD') : '-';
          case 'number':
            return typeof _value === 'number' ? _value.toLocaleString() : String(_value ?? '-');
          case 'tag':
          case 'badge':
            return <span>{String(_value ?? '-')}</span>; // TODO: Tag/Badge 컴포넌트 사용
          default:
            return String(_value ?? '-');
        }
      },
    }));

    // SDUI v1.2: rowActionHandlers가 있으면 액션 컬럼 추가
    if (rowActionHandlers && Object.keys(rowActionHandlers).length > 0) {
      baseColumns.push({
        key: '_actions',
        label: translations['TABLE.ACTIONS'] || '액션',
        width: '120',
        align: 'right' as 'left' | 'right' | 'center',
        render: (_value: unknown, _row: unknown) => {
          const row = _row as Record<string, unknown>;
          return (
            <div style={{ display: 'flex', gap: 'var(--spacing-xs)', justifyContent: 'flex-end' }}>
              {Object.keys(rowActionHandlers).map((actionKey) => {
                const actionDef = rowActionHandlers[actionKey];
                const actionLabel = translations[`TABLE.ACTION.${actionKey.toUpperCase()}`] || actionKey;
                return (
                  <button
                    key={actionKey}
                    onClick={async (e) => {
                      e.stopPropagation();
                      const fullContext: ActionContext = {
                        selectedRows: [row],
                        translations,
                        ...actionContext,
                        apiCall,
                      };
                      // rowId를 endpoint에 치환
                      if (actionDef.endpoint && row.id) {
                        actionDef.endpoint = actionDef.endpoint.replace('{rowId}', String(row.id));
                      }
                      await executeAction(actionDef, fullContext);
                    }}
                    style={{
                      padding: 'var(--spacing-xs) var(--spacing-sm)',
                      fontSize: 'var(--font-size-sm)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: 'var(--color-background)',
                      color: 'var(--color-text)',
                      cursor: 'pointer',
                    }}
                  >
                    {actionLabel}
                  </button>
                );
              })}
            </div>
          );
        },
      });
    }

    return baseColumns;
  }, [columns, translations, rowActionHandlers, actionContext, apiCall]);

  // SDUI v1.1: 행 클릭 핸들러
  const handleRowClick = React.useCallback(async (row: Record<string, unknown>) => {
    // onRowClick prop이 있으면 우선 사용
    if (onRowClick) {
      onRowClick(row);
      return;
    }
    // schema.actions가 있으면 Action Engine 실행
    if (schema.actions && schema.actions.length > 0) {
      const fullContext: ActionContext = {
        selectedRows: [row],
        translations,
        ...actionContext,
      };
      await executeActionsForEvent('onRowClick', schema.actions, fullContext);
    }
  }, [onRowClick, schema.actions, actionContext, translations]);

  // 페이지 변경 핸들러 (React Hooks 규칙 준수: 조건부 return 이전에 호출)
  const handlePageChange = React.useCallback((page: number) => {
    setCurrentPage(page);
    onPageChange?.(page);
  }, [onPageChange]);

  // 페이지네이션 계산 (React Hooks 규칙 준수: 조건부 return 이전에 계산)
  const allData = React.useMemo(() => {
    if (injectedData) return injectedData;
    if (Array.isArray(data)) return data as Record<string, unknown>[];
    // apiClient.get() 응답 형태 방어 (예: { data: [...] })
    if (data && typeof data === 'object' && 'data' in (data as Record<string, unknown>)) {
      const inner = (data as { data?: unknown }).data;
      return Array.isArray(inner) ? (inner as Record<string, unknown>[]) : [];
    }
    return [];
  }, [data, injectedData]);
  const totalPages = React.useMemo(() => {
    if (!paginationConfig) return 1;
    const basis = typeof totalCount === 'number' ? totalCount : allData.length;
    const pages = Math.ceil(basis / itemsPerPage);
    return pages > 0 ? pages : 1; // 최소 1페이지는 보장
  }, [allData.length, itemsPerPage, paginationConfig, totalCount]);

  // 페이지네이션 적용된 데이터 계산
  const paginatedData = React.useMemo(() => {
    if (!paginationConfig) return allData;
    // 서버 페이지네이션 모드: injectedData가 이미 해당 페이지 데이터임
    if (typeof totalCount === 'number') return allData;
    const startIndex = (effectivePage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return allData.slice(startIndex, endIndex);
  }, [allData, effectivePage, itemsPerPage, paginationConfig, totalCount]);

  if (!injectedData && isLoading) {
    return <div className={className}>로딩 중...</div>;
  }

  if (!injectedData && error) {
    return <div className={className}>에러: {error instanceof Error ? error.message : String(error)}</div>;
  }

  return (
    <div className={className}>
      <DataTable
        data={paginatedData}
        columns={dataTableColumns}
        keyExtractor={(row: Record<string, unknown>) => (row.id as string) || (row[columns[0]?.key] as string)}
        onRowClick={(onRowClick || (rowActions && rowActions.length > 0)) ? handleRowClick : undefined}
        emptyMessage="데이터가 없습니다."
        pagination={undefined}
        itemsPerPage={itemsPerPage}
      />
      {/* 페이지네이션: 테이블 영역 밖에 렌더링 */}
      {paginationConfig && (
        <div
          style={{
            padding: 'var(--spacing-lg)',
            display: 'flex',
            justifyContent: 'center',
            marginTop: 'var(--spacing-md)',
          }}
        >
          <Pagination
            currentPage={effectivePage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
          />
        </div>
      )}
      {/* TODO: selection, bulkActions, virtualization 지원 */}
    </div>
  );
};

