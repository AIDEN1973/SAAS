/**
 * DataTable Component
 * 
 * [ë¶ˆë? ê·œì¹™] ?°ìŠ¤?¬í†± ?˜ê²½?ì„œ ?¬ìš©?˜ëŠ” ê³ ì • ?¤ë” + ?˜í‰ ?¤í¬ë¡??Œì´ë¸?
 * [ë¶ˆë? ê·œì¹™] ?¤í‚¤ë§ˆì—??Tailwind ?´ë˜?¤ë? ì§ì ‘ ?¬ìš©?˜ì? ?ŠëŠ”??
 * [ë¶ˆë? ê·œì¹™] PC (lg, xl)?ì„œ ?¬ìš©
 */

import React from 'react';
import { clsx } from 'clsx';
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
 * DataTable ì»´í¬?ŒíŠ¸
 * 
 * ?°ìŠ¤?¬í†± ?˜ê²½?ì„œ ?Œì´ë¸??°ì´?°ë? ???•ì‹?¼ë¡œ ?œì‹œ
 */
export function DataTable<T = any>({
  data,
  columns,
  keyExtractor,
  onRowClick,
  emptyMessage = '?°ì´?°ê? ?†ìŠµ?ˆë‹¤.',
  className,
  stickyHeader = true,
}: DataTableProps<T>) {
  const mode = useResponsiveMode();
  const isDesktop = mode === 'lg' || mode === 'xl';

  // ?°ìŠ¤?¬í†±???„ë‹ˆë©?null ë°˜í™˜ (TableCardView ?¬ìš©)
  if (!isDesktop) {
    return null;
  }

  return (
    <div
      className={clsx(className)}
      style={{
        width: '100%',
        overflowX: 'auto',
        border: '1px solid var(--color-gray-200)',
        borderRadius: 'var(--border-radius-lg)',
      }}
    >
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
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
            {columns.map((column) => (
              <th
                key={column.key}
                style={{
                  padding: 'var(--spacing-md)',
                  textAlign: column.align || 'left',
                  fontSize: 'var(--font-size-sm)',
                  fontWeight: 'var(--font-weight-semibold)',
                  color: 'var(--color-text)',
                  borderBottom: '2px solid var(--color-gray-200)',
                  whiteSpace: 'nowrap',
                  width: column.width,
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
                  padding: 'var(--spacing-xl)',
                  textAlign: 'center',
                  color: 'var(--color-text-secondary)',
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
                    borderBottom: '1px solid var(--color-gray-200)',
                    transition: 'background-color 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (onRowClick) {
                      e.currentTarget.style.backgroundColor = 'var(--color-gray-50)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  {columns.map((column) => {
                    const value = (row as any)[column.key];
                    return (
                      <td
                        key={column.key}
                        style={{
                          padding: 'var(--spacing-md)',
                          textAlign: column.align || 'left',
                          fontSize: 'var(--font-size-base)',
                          color: 'var(--color-text)',
                        }}
                      >
                        {column.render ? column.render(value, row) : value}
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

