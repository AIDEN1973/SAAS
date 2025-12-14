/**
 * DataTable Component
 *
 * [불변 규칙] 데스크톱 환경에서 사용하는 고정 헤더 + 스크롤 가능한 테이블
 * [불변 규칙] 스키마에서는 Tailwind 클래스를 직접 사용하지 않습니다.
 * [불변 규칙] PC (lg, xl)에서 사용
 */

import React from 'react';
import { clsx } from 'clsx';
import { useResponsiveMode } from '../hooks/useResponsiveMode';

export interface DataTableColumn<T = unknown> {
  key: string;
  label: string;
  render?: (value: unknown, row: T) => React.ReactNode;
  width?: string;
  align?: 'left' | 'center' | 'right';
  className?: string;
}

export interface DataTableProps<T = unknown> {
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
export function DataTable<T = unknown>({
  data,
  columns,
  keyExtractor,
  onRowClick,
  emptyMessage = '데이터가 없습니다.',
  className,
  stickyHeader = true,
}: DataTableProps<T>) {
  const mode = useResponsiveMode();
  const isDesktop = mode === 'lg' || mode === 'xl';

  // 데스크톱이 아니면 null 반환 (TableCardView 사용)
  if (!isDesktop) {
    return null;
  }

  return (
    <div
      className={clsx(className)}
      style={{
        width: '100%',
        overflowX: 'auto',
        borderRadius: 'var(--border-radius-sm)',
        border: 'var(--border-width-thin) solid var(--color-gray-200)', // styles.css 준수: border-width 토큰 사용
        backgroundColor: 'var(--color-white)',
        boxShadow: 'var(--shadow-sm)',
        overflow: 'hidden',
      }}
    >
      <table
        style={{
          width: '100%',
          borderCollapse: 'separate',
          borderSpacing: 0,
          minWidth: '100%',
        }}
      >
        {/* Header */}
        <thead
          style={{
            backgroundColor: 'var(--color-gray-50)',
            position: stickyHeader ? 'sticky' : 'static',
            top: 0,
            zIndex: 'var(--z-sticky)',
          }}
        >
          <tr>
            {columns.map((column, index) => (
              <th
                key={column.key}
                style={{
                  padding: 'var(--spacing-lg) var(--spacing-md)',
                  textAlign: column.align || 'left',
                  fontWeight: 'var(--font-weight-semibold)',
                  fontSize: 'var(--font-size-sm)',
                  color: 'var(--color-text-secondary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em', // letter-spacing은 일반적으로 em 단위 사용 (상대값)
                  borderBottom: 'var(--border-width-thin) solid var(--color-gray-200)', // styles.css 준수: border-width 토큰 사용
                  whiteSpace: 'nowrap',
                  width: column.width,
                  backgroundColor: 'var(--color-gray-50)',
                  ...(index === 0 && {
                    paddingLeft: 'var(--spacing-lg)',
                  }),
                  ...(index === columns.length - 1 && {
                    paddingRight: 'var(--spacing-lg)',
                  }),
                }}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>

        {/* Body */}
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                style={{
                  padding: 'var(--spacing-3xl)',
                  textAlign: 'center',
                  color: 'var(--color-text-tertiary)',
                  fontSize: 'var(--font-size-sm)',
                }}
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row, index) => {
              const key = keyExtractor ? keyExtractor(row) : index;
              return (
                <tr
                  key={key}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  style={{
                    cursor: onRowClick ? 'pointer' : 'default',
                    borderBottom: 'var(--border-width-thin) solid var(--color-gray-100)', // styles.css 준수: border-width 토큰 사용
                    transition: 'var(--transition-all)',
                    backgroundColor: 'var(--color-white)',
                  }}
                  onMouseEnter={(e) => {
                    if (onRowClick) {
                      e.currentTarget.style.backgroundColor = 'var(--color-gray-50)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--color-white)';
                  }}
                >
                  {columns.map((column, colIndex) => {
                    const value = (row as Record<string, unknown>)[column.key];
                    return (
                      <td
                        key={column.key}
                        style={{
                          padding: 'var(--spacing-lg) var(--spacing-md)',
                          textAlign: column.align || 'left',
                          color: 'var(--color-text)',
                          fontSize: 'var(--font-size-sm)',
                          ...(colIndex === 0 && {
                            paddingLeft: 'var(--spacing-lg)',
                          }),
                          ...(colIndex === columns.length - 1 && {
                            paddingRight: 'var(--spacing-lg)',
                          }),
                        }}
                      >
                        {column.render ? column.render(value, row) : String(value ?? '')}
                      </td>
                    );
                  })}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

