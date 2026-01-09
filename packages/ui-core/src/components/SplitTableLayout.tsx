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
  // HARD-CODE-EXCEPTION: 우측 상세 패널 최소 너비 지정 (레이아웃용 특수 값, CSS 변수로 대체 가능하나 현재 토큰 없음)
  detailMinWidth = '22.5rem', // 360px - styles.css 준수: rem 단위 사용
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
          minWidth: 'var(--width-student-info-min)', // styles.css 준수: 학생 정보 최소 너비 토큰 사용
          overflow: 'auto',
          borderRadius: 'var(--border-radius-sm)',
          backgroundColor: 'var(--color-white)',
          border: 'var(--border-width-thin) solid var(--color-gray-200)', // styles.css 준수: border-width 토큰 사용
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
                minWidth: 'var(--touch-target-min)', // styles.css 준수: 터치 타깃 최소 크기 (접근성)
                minHeight: 'var(--touch-target-min)', // styles.css 준수: 터치 타깃 최소 크기 (접근성)
                transition: 'var(--transition-all)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-primary-hover)';
                e.currentTarget.style.color = 'var(--color-text)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = 'var(--color-text-secondary)';
              }}
            >
              <svg
                style={{
                  width: 'var(--size-checkbox)', // styles.css 준수: 체크박스 크기 토큰 사용 (20px)
                  height: 'var(--size-checkbox)', // styles.css 준수: 체크박스 크기 토큰 사용 (20px)
                }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5} // SVG strokeWidth는 시각적 두께이므로 하드코딩 허용
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
