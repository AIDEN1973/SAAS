/**
 * DataTable Component
 *
 * [불변 규칙] Atlaskit DynamicTable을 래핑하여 사용합니다.
 * [불변 규칙] 데스크톱 환경에서 사용하는 고정 헤더 + 스크롤 가능한 테이블
 * [불변 규칙] 스키마에서는 Tailwind 클래스를 직접 사용하지 않습니다.
 * [불변 규칙] PC (lg, xl)에서 사용
 */

import React from 'react';
import DynamicTable from '@atlaskit/dynamic-table';
import { useResponsiveMode } from '../hooks/useResponsiveMode';

export interface DataTableColumn<T = any> {
  key: string;
  label: string;
  render?: (value: any, row: T) => React.ReactNode;
  width?: string;
  align?: 'left' | 'center' | 'right';
  className?: string;
}

export interface DataTableProps<T = any> {
  data: T[];
  columns: DataTableColumn<T>[];
  keyExtractor?: (row: T) => string | number;
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
  className?: string;
  stickyHeader?: boolean;
}

/**
 * DataTable 컴포넌트
 *
 * 데스크톱 환경에서 테이블 데이터를 테이블 형식으로 표시
 */
export function DataTable<T = any>({
  data,
  columns,
  keyExtractor,
  onRowClick,
  emptyMessage = '?�이?��? ?�습?�다.',
  className,
  stickyHeader = true,
}: DataTableProps<T>) {
  const mode = useResponsiveMode();
  const isDesktop = mode === 'lg' || mode === 'xl';

  // 데스크톱이 아니면 null 반환 (TableCardView 사용)
  if (!isDesktop) {
    return null;
  }

  // DynamicTable용 head 변환
  const head = React.useMemo(() => {
    return {
      cells: columns.map((column) => ({
        key: column.key,
        content: column.label,
        width: column.width,
        isSortable: false,
      })),
    };
  }, [columns]);

  // DynamicTable용 rows 변환
  const rows = React.useMemo(() => {
    if (data.length === 0) {
      return [
        {
          key: 'empty',
          cells: [
            {
              key: 'empty',
              content: emptyMessage,
              colSpan: columns.length,
            },
          ],
        },
      ];
    }

    return data.map((row, index) => {
      const key = keyExtractor ? String(keyExtractor(row)) : String(index);
      return {
        key,
        cells: columns.map((column) => {
          const value = (row as any)[column.key];
          return {
            key: column.key,
            content: column.render ? column.render(value, row) : value,
          };
        }),
        onClick: onRowClick ? () => onRowClick(row) : undefined,
      };
    });
  }, [data, columns, keyExtractor, onRowClick, emptyMessage]);

  return (
    <div className={className}>
      <DynamicTable
        head={head as any}
        rows={rows as any}
        isFixedSize={stickyHeader}
      />
    </div>
  );
}

