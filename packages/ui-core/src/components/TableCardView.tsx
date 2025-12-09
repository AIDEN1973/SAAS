/**
 * TableCardView Component
 *
 * [불변 규칙] 모바일 환경에서 테이블을 카드 UI로 자동 변환
 * [불변 규칙] 스키마에서는 Tailwind 클래스를 직접 사용하지 않습니다.
 * [불변 규칙] 모바일(xs, sm)에서 사용
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
 * TableCardView 컴포넌트
 *
 * 모바일 환경에서 테이블 데이터를 카드 형태로 표시
 */
export function TableCardView<T = any>({
  data,
  columns,
  keyExtractor,
  onRowClick,
  emptyMessage = '데이터가 없습니다.',
  className,
}: TableCardViewProps<T>) {
  const mode = useResponsiveMode();
  const isMobile = mode === 'xs' || mode === 'sm';

  // 모바일이 아니면 null 반환 (DataTable 사용)
  if (!isMobile) {
    return null;
  }

  if (data.length === 0) {
    return (
      <div
        style={{
          padding: 'var(--spacing-3xl)',
          textAlign: 'center',
          color: 'var(--color-text-tertiary)',
          fontSize: 'var(--font-size-sm)',
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
            padding="lg"
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            style={{
              cursor: onRowClick ? 'pointer' : 'default',
              transition: 'var(--transition-all)',
            }}
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--spacing-md)',
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
                        fontWeight: 'var(--font-weight-semibold)',
                        fontSize: 'var(--font-size-xs)',
                        color: 'var(--color-text-secondary)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}
                    >
                      {column.label}
                    </div>
                    <div
                      style={{
                        color: 'var(--color-text)',
                        fontSize: 'var(--font-size-sm)',
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

