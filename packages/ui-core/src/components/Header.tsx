/**
 * Header Component
 *
 * 상단 헤더 메뉴
 * [불변 규칙] 반응형: Mobile에서는 햄버거 메뉴, Desktop에서는 전체 메뉴 표시
 */

import React, { useMemo } from 'react';
import { clsx } from 'clsx';
import { useResponsiveMode } from '../hooks/useResponsiveMode';
import { Button } from './Button';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';

export interface HeaderProps {
  title?: string;
  logo?: React.ReactNode;
  onMenuClick?: () => void;
  rightContent?: React.ReactNode;
  className?: string;
  sidebarCollapsed?: boolean;
  onSidebarToggle?: () => void;
  showSidebarToggle?: boolean; // 토글 버튼 표시 여부 (데스크톱에서만)
}

export const Header: React.FC<HeaderProps> = ({
  title = '디어쌤',
  logo,
  onMenuClick,
  rightContent,
  className,
  sidebarCollapsed,
  onSidebarToggle,
  showSidebarToggle = true, // 기본값: true (기존 동작 유지)
}) => {
  const mode = useResponsiveMode();
  const isMobile = mode === 'xs' || mode === 'sm';

  // CSS 변수에서 strokeWidth 읽기 (하드코딩 제거)
  const strokeWidth = useMemo(() => {
    if (typeof window !== 'undefined') {
      const value = getComputedStyle(document.documentElement)
        .getPropertyValue('--stroke-width-icon')
        .trim();
      return value ? Number(value) : 1.5;
    }
    return 1.5;
  }, []);

  // CSS 변수에서 icon size 읽기
  const iconSize = useMemo(() => {
    if (typeof window !== 'undefined') {
      const value = getComputedStyle(document.documentElement)
        .getPropertyValue('--size-icon-base')
        .trim();
      if (value.endsWith('rem')) {
        const remValue = parseFloat(value);
        return remValue * 16;
      }
      if (value.endsWith('px')) {
        return parseFloat(value);
      }
      return value ? Number(value) : 16;
    }
    return 16;
  }, []);

  const isTablet = mode === 'md';
  const isDesktop = mode === 'lg' || mode === 'xl';

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
          ? 'var(--padding-header-vertical) var(--spacing-lg)' // 모바일: 상하 패딩 CSS 변수 사용, 좌우 24px (Container와 동일)
          : 'var(--padding-header-vertical) var(--spacing-xl)', // 태블릿 이상: 상하 패딩 CSS 변수 사용, 좌우 32px
        minHeight: 'var(--height-header)', // styles.css 준수: 헤더 최소 높이 고정 (태블릿/데스크탑 일관성 유지)
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
                strokeWidth={strokeWidth * 1.67} // SVG는 약간 더 두껍게 (시각적 강조)
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
            letterSpacing: 'var(--letter-spacing-title)', // styles.css 준수: 타이틀 글자 간격 토큰 사용
          }}
        >
          {title}
        </h1>
        {!isMobile && onSidebarToggle && showSidebarToggle && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onSidebarToggle}
            style={{
              padding: 'var(--spacing-sm)',
              borderRadius: 'var(--border-radius-sm)',
              minWidth: 'var(--touch-target-min)', // styles.css 준수: 터치 타깃 최소 크기 (접근성)
              minHeight: 'var(--touch-target-min)', // styles.css 준수: 터치 타깃 최소 크기 (접근성)
            }}
          >
            {sidebarCollapsed ? (
              <PanelLeftOpen
                size={iconSize}
                strokeWidth={strokeWidth}
                style={{
                  color: 'currentColor',
                }}
              />
            ) : (
              <PanelLeftClose
                size={iconSize}
                strokeWidth={strokeWidth}
                style={{
                  color: 'currentColor',
                }}
              />
            )}
          </Button>
        )}
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
