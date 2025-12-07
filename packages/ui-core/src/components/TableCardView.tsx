/**
 * TableCardView Component
 * 
 * [ë¶ˆë? ê·œì¹™] ëª¨ë°”???˜ê²½?ì„œ ?Œì´ë¸”ì„ ì¹´ë“œ??UIë¡??ë™ ?„í™˜
 * [ë¶ˆë? ê·œì¹™] ?¤í‚¤ë§ˆì—??Tailwind ?´ë˜?¤ë? ì§ì ‘ ?¬ìš©?˜ì? ?ŠëŠ”??
 * [ë¶ˆë? ê·œì¹™] ?´ë???(xs, sm)?ì„œ ?¬ìš©
 */

import React from 'react';
import { clsx } from 'clsx';
import { Card } from './Card';
import { useResponsiveMode } from '../hooks/useResponsiveMode';

export interface TableCardViewColumn<T = any> {
  key: string;
  label: string;
  render?: (value: any, row: T) => React.ReactNode;
  className?: string;
}

export interface TableCardViewProps<T = any> {
  data: T[];
  columns: TableCardViewColumn<T>[];
  keyExtractor?: (row: T) => string | number;
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
  className?: string;
}

/**
 * TableCardView ì»´í¬?ŒíŠ¸
 * 
 * ëª¨ë°”???˜ê²½?ì„œ ?Œì´ë¸??°ì´?°ë? ì¹´ë“œ ?•íƒœë¡??œì‹œ
 */
export function TableCardView<T = any>({
  data,
  columns,
  keyExtractor,
  onRowClick,
  emptyMessage = '?°ì´?°ê? ?†ìŠµ?ˆë‹¤.',
  className,
}: TableCardViewProps<T>) {
  const mode = useResponsiveMode();
  const isMobile = mode === 'xs' || mode === 'sm';

  // ëª¨ë°”?¼ì´ ?„ë‹ˆë©?null ë°˜í™˜ (DataTable ?¬ìš©)
  if (!isMobile) {
    return null;
  }

  if (data.length === 0) {
    return (
      <div
        style={{
          padding: 'var(--spacing-xl)',
          textAlign: 'center',
          color: 'var(--color-text-secondary)',
        }}
      >
        {emptyMessage}
      </div>
    );
  }

  return (
    <div
      className={clsx(className)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--spacing-md)',
      }}
    >
      {data.map((row, index) => {
        const key = keyExtractor ? keyExtractor(row) : index;
        return (
          <Card
            key={key}
            variant="default"
            padding="md"
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            style={{
              cursor: onRowClick ? 'pointer' : 'default',
            }}
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--spacing-sm)',
              }}
            >
              {columns.map((column) => {
                const value = (row as any)[column.key];
                return (
                  <div
                    key={column.key}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 'var(--spacing-xs)',
                    }}
                  >
                    <div
                      style={{
                        fontSize: 'var(--font-size-xs)',
                        fontWeight: 'var(--font-weight-medium)',
                        color: 'var(--color-text-secondary)',
                      }}
                    >
                      {column.label}
                    </div>
                    <div
                      style={{
                        fontSize: 'var(--font-size-base)',
                        color: 'var(--color-text)',
                      }}
                    >
                      {column.render ? column.render(value, row) : value}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

