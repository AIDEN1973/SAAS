/**
 * Header Component
 *
 * 상단 헤더 메뉴
 * [불변 규칙] 반응형: Mobile에서는 햄버거 메뉴, Desktop에서는 전체 메뉴 표시
 */

import React from 'react';
import { clsx } from 'clsx';
import { useResponsiveMode } from '../hooks/useResponsiveMode';
import { Button } from './Button';

export interface HeaderProps {
  title?: string;
  logo?: React.ReactNode;
  onMenuClick?: () => void;
  rightContent?: React.ReactNode;
  className?: string;
}

export const Header: React.FC<HeaderProps> = ({
  title = '디어쌤',
  logo,
  onMenuClick,
  rightContent,
  className,
}) => {
  const mode = useResponsiveMode();
  const isMobile = mode === 'xs' || mode === 'sm';

  return (
    <header
      className={clsx(className)}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 'var(--z-sticky)',
        backgroundColor: 'var(--glass-background)',
        backdropFilter: 'var(--backdrop-blur)',
        WebkitBackdropFilter: 'var(--backdrop-blur)',
        borderBottom: 'var(--border-width-thin) solid var(--color-gray-200)', // styles.css 준수: border-width 토큰 사용
        // 모바일(xs, sm): 바디 영역과 동일한 좌우 여백 (lg = 24px), 태블릿 이상(md+): 넓은 여백 (xl = 32px)
        padding: isMobile
          ? 'var(--spacing-md) var(--spacing-lg)' // 모바일: 상하 16px, 좌우 24px (Container와 동일)
          : 'var(--spacing-md) var(--spacing-xl)', // 태블릿 이상: 상하 16px, 좌우 32px
        boxShadow: 'var(--shadow-sm)',
        transition: 'var(--transition-all)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-lg)' }}>
        {isMobile && onMenuClick && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onMenuClick}
            style={{
              padding: 'var(--spacing-sm)',
              borderRadius: 'var(--border-radius-sm)',
              minWidth: 'var(--touch-target-min)', // styles.css 준수: 터치 타깃 최소 크기 (접근성)
              minHeight: 'var(--touch-target-min)', // styles.css 준수: 터치 타깃 최소 크기 (접근성)
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
                strokeWidth={2.5}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </Button>
        )}
        {logo && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              borderRadius: 'var(--border-radius-sm)',
            }}
          >
            {logo}
          </div>
        )}
        <h1
          style={{
            fontWeight: 'var(--font-weight-bold)',
            fontSize: 'var(--font-size-xl)',
            color: 'var(--color-text)',
            margin: 0,
            letterSpacing: '-0.02em',
          }}
        >
          {title}
        </h1>
      </div>
      {rightContent && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-md)',
          }}
        >
          {rightContent}
        </div>
      )}
    </header>
  );
};
