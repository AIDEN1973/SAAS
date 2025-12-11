/**
 * SplitTableLayout Component
 *
 * [불변 규칙] 태블릿 환경에서 사용하는 좌측 목록 + 우측 상세 패널 레이아웃
 * [불변 규칙] 스키마에서는 Tailwind 클래스를 직접 사용하지 않습니다.
 * [불변 규칙] 태블릿(md)에서 사용
 * [불변 규칙] 우측 상세 패널 최소 너비 360px
 */

import React from 'react';
import { clsx } from 'clsx';
import { Card } from './Card';
import { useResponsiveMode } from '../hooks/useResponsiveMode';

export interface SplitTableLayoutProps {
  list: React.ReactNode;
  detail: React.ReactNode;
  listWidth?: string;
  detailMinWidth?: string;
  className?: string;
  onDetailClose?: () => void;
}

/**
 * SplitTableLayout 컴포넌트
 *
 * 태블릿 환경에서 좌측 목록과 우측 상세 패널을 동시에 표시
 */
export const SplitTableLayout: React.FC<SplitTableLayoutProps> = ({
  list,
  detail,
  listWidth = '40%',
  detailMinWidth = '360px',
  className,
  onDetailClose,
}) => {
  const mode = useResponsiveMode();
  const isTablet = mode === 'md';

  // 태블릿이 아니면 목록만 표시
  if (!isTablet) {
    return <div className={clsx(className)}>{list}</div>;
  }

  return (
    <div
      className={clsx(className)}
      style={{
        display: 'flex',
        height: '100%',
        gap: 'var(--spacing-lg)',
        transition: 'var(--transition-all)',
      }}
    >
      {/* Left: List */}
      <div
        style={{
          width: listWidth,
          minWidth: '200px',
          overflow: 'auto',
          borderRadius: 'var(--border-radius-sm)',
          backgroundColor: 'var(--color-white)',
          border: '1px solid var(--color-gray-200)',
          boxShadow: 'var(--shadow-sm)',
          padding: 'var(--spacing-md)',
        }}
      >
        {list}
      </div>

      {/* Right: Detail Panel */}
      <Card
        variant="elevated"
        padding="lg"
        style={{
          flex: 1,
          minWidth: detailMinWidth,
          overflow: 'auto',
          position: 'sticky',
          top: 'var(--spacing-xl)',
          maxHeight: 'calc(100vh - var(--spacing-2xl))',
          transition: 'var(--transition-all)',
        }}
      >
        {onDetailClose && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              marginBottom: 'var(--spacing-md)',
            }}
          >
            <button
              onClick={onDetailClose}
              style={{
                padding: 'var(--spacing-sm)',
                border: 'none',
                borderRadius: 'var(--border-radius-sm)',
                backgroundColor: 'transparent',
                cursor: 'pointer',
                color: 'var(--color-text-secondary)',
                minWidth: '44px',
                minHeight: '44px',
                transition: 'var(--transition-all)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-gray-100)';
                e.currentTarget.style.color = 'var(--color-text)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = 'var(--color-text-secondary)';
              }}
            >
              <svg
                style={{ width: '20px', height: '20px' }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        )}
        {detail}
      </Card>
    </div>
  );
};
