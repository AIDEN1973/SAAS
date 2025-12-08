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
        gap: 'var(--spacing-md)',
      }}
    >
      {/* Left: List */}
      <div
        style={{
          width: listWidth,
          minWidth: '200px',
          overflow: 'auto',
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
          top: 0,
          maxHeight: '100vh',
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
                padding: 'var(--spacing-xs)',
                border: 'none',
                backgroundColor: 'transparent',
                cursor: 'pointer',
                fontSize: 'var(--font-size-lg)',
                color: 'var(--color-text-secondary)',
                minWidth: '44px',
                minHeight: '44px',
              }}
            >
              ✕
            </button>
          </div>
        )}
        {detail}
      </Card>
    </div>
  );
};
