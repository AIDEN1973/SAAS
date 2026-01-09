/**
 * Drawer Component
 *
 * [불변 규칙] 스키마에서는 Tailwind 클래스를 직접 사용하지 않습니다.
 * [불변 규칙] 모든 스타일은 design-system 토큰을 사용합니다.
 * [불변 규칙] 모바일 환경에서 Fullscreen Drawer 사용
 */

import React, { useEffect } from 'react';
import { clsx } from 'clsx';
import { Card } from './Card';
import { useResponsiveMode } from '../hooks/useResponsiveMode';

export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  position?: 'left' | 'right' | 'top' | 'bottom';
  width?: string;
  height?: string;
  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
  className?: string;
}

/**
 * Drawer 컴포넌트
 *
 * 모바일 Fullscreen Drawer
 * 데스크톱: 사이드 Drawer
 */
export const Drawer: React.FC<DrawerProps> = ({
  isOpen,
  onClose,
  title,
  children,
  position = 'right',
  width = 'var(--width-drawer)', // styles.css 준수: Drawer 기본 너비 토큰 사용
  height = '100%',
  closeOnOverlayClick = true,
  closeOnEscape = true,
  className,
}) => {
  const mode = useResponsiveMode();
  const isMobile = mode === 'xs' || mode === 'sm';

  useEffect(() => {
    if (!isOpen || !closeOnEscape) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, closeOnEscape, onClose]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const positionStyles: Record<'left' | 'right' | 'top' | 'bottom', React.CSSProperties> = {
    left: {
      top: 0,
      left: 0,
      bottom: 0,
      width: isMobile ? '100%' : width,
      height: '100%',
      transform: isOpen ? 'translateX(0)' : 'translateX(-100%)',
    },
    right: {
      top: 0,
      right: 0,
      bottom: 0,
      width: isMobile ? '100%' : width,
      height: '100%',
      transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
    },
    top: {
      top: 0,
      left: 0,
      right: 0,
      height: isMobile ? '100%' : height,
      transform: isOpen ? 'translateY(0)' : 'translateY(-100%)',
    },
    bottom: {
      bottom: 0,
      left: 0,
      right: 0,
      height: isMobile ? '100%' : height,
      transform: isOpen ? 'translateY(0)' : 'translateY(100%)',
    },
  };

  return (
    <div
      className={clsx(className)}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 'var(--z-modal)',
      }}
    >
      {/* Backdrop */}
      {!isMobile && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'var(--overlay-background)',
            zIndex: 'var(--z-modal-backdrop)',
          }}
          onClick={closeOnOverlayClick ? onClose : undefined}
        />
      )}

      {/* Drawer Content */}
      <Card
        variant="elevated"
        padding="lg"
        style={{
          position: 'absolute',
          zIndex: 'var(--z-modal)',
          backgroundColor: 'var(--color-white)',
          display: 'flex',
          flexDirection: 'column',
          transition: 'var(--transition-transform)',
          ...positionStyles[position],
        }}
      >
        {/* Header */}
        {title && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              // 우측 레이어 메뉴 헤더와 동일한 스타일: 모바일(xs, sm): 상하 var(--padding-header-vertical), 좌우 var(--spacing-lg), 태블릿 이상(md+): 상하 var(--padding-header-vertical), 좌우 var(--spacing-xl)
              padding: isMobile
                ? 'var(--padding-header-vertical) var(--spacing-lg)' // 모바일: 상하 패딩 CSS 변수 사용, 좌우 CSS 변수 사용
                : 'var(--padding-header-vertical) var(--spacing-xl)', // 태블릿 이상: 상하 패딩 CSS 변수 사용, 좌우 CSS 변수 사용
              borderBottom: 'var(--border-width-thin) solid var(--color-primary-dark)',
              backgroundColor: 'var(--color-primary)',
              minHeight: 'var(--height-header)', // 글로벌 헤더 높이와 동일하게 설정
            }}
          >
            <h2
              style={{
                fontWeight: 'var(--font-weight-bold)',
                fontSize: 'var(--font-size-lg)',
                margin: 0,
                color: 'var(--color-white)',
                letterSpacing: 'var(--letter-spacing-title)', // styles.css 준수: 타이틀 글자 간격 토큰 사용
                flex: 1,
              }}
            >
              {title}
            </h2>
            <button
              onClick={onClose}
              aria-label="닫기"
              style={{
                minWidth: 'var(--touch-target-min)', // styles.css 준수: 터치 타깃 최소 크기 (접근성)
                minHeight: 'var(--touch-target-min)', // styles.css 준수: 터치 타깃 최소 크기 (접근성)
                backgroundColor: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                fontSize: 'var(--font-size-3xl)',
                color: 'var(--color-white)',
                fontWeight: 'var(--font-weight-medium)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                lineHeight: 'var(--line-height-tight)',
                opacity: 'var(--opacity-subtle)',
                transition: 'opacity var(--transition-base)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = 'var(--opacity-full)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = 'var(--opacity-subtle)';
              }}
            >
              ×
            </button>
          </div>
        )}

        {/* Content */}
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
          }}
        >
          {children}
        </div>
      </Card>
    </div>
  );
};

