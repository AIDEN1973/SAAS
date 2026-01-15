/**
 * Modal Component
 *
 * [불변 규칙] 스키마에서는 Tailwind 클래스를 직접 사용하지 않습니다.
 * [불변 규칙] 모든 스타일은 design-system 토큰을 사용합니다.
 */

import React, { useEffect } from 'react';
import { clsx } from 'clsx';
import { Card } from './Card';
import { useResponsiveMode } from '../hooks/useResponsiveMode';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Modal 컴포넌트
 *
 * 오버레이 위에 표시되는 모달 레이아웃
 */
export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = 'md',
  closeOnOverlayClick = true,
  closeOnEscape = true,
  className,
  style,
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

  const sizeMap: Record<'sm' | 'md' | 'lg' | 'xl' | 'full', React.CSSProperties> = {
    sm: {
      width: isMobile ? 'var(--width-modal-mobile-sm-md)' : 'var(--width-modal-sm)', // styles.css 준수: 모달 크기 토큰 사용
      maxWidth: 'var(--width-modal-max-sm-md)', // styles.css 준수: 모달 최대 너비 토큰 사용
    },
    md: {
      width: isMobile ? 'var(--width-modal-mobile-sm-md)' : 'var(--width-modal-md)', // styles.css 준수: 모달 크기 토큰 사용
      maxWidth: 'var(--width-modal-max-sm-md)', // styles.css 준수: 모달 최대 너비 토큰 사용
    },
    lg: {
      width: isMobile ? 'var(--width-modal-mobile-lg-xl)' : 'var(--width-modal-lg)', // styles.css 준수: 모달 크기 토큰 사용
      maxWidth: 'var(--width-modal-max-lg-xl)', // styles.css 준수: 모달 최대 너비 토큰 사용
    },
    xl: {
      width: isMobile ? 'var(--width-modal-mobile-lg-xl)' : 'var(--width-modal-xl)', // styles.css 준수: 모달 크기 토큰 사용
      maxWidth: 'var(--width-modal-max-lg-xl)', // styles.css 준수: 모달 최대 너비 토큰 사용
    },
    full: {
      width: 'var(--width-full)', // styles.css 준수: 전체 너비 토큰 사용
      height: 'var(--height-full)', // styles.css 준수: 전체 높이 토큰 사용
      maxWidth: 'var(--width-viewport)', // styles.css 준수: 뷰포트 전체 너비 토큰 사용
      maxHeight: 'var(--height-viewport)', // styles.css 준수: 뷰포트 전체 높이 토큰 사용
    },
  };

  // [불변 규칙] CSS 변수 사용: 하드코딩 금지
  // Popover(--z-popover: 1060)보다 낮은 z-index를 사용하여 드롭다운이 모달 위에 표시되도록 함

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
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: isMobile ? 'var(--spacing-md)' : 'var(--spacing-lg)',
      }}
    >
      {/* Backdrop */}
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

      {/* Modal Content */}
      <Card
        variant="elevated"
        style={{
          position: 'relative',
          zIndex: 'var(--z-modal)',
          maxHeight: isMobile ? 'var(--height-modal-max-mobile)' : 'var(--height-modal-max)', // styles.css 준수: 모달 높이 토큰 사용
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          padding: 'var(--spacing-none)', // styles.css 준수: spacing 토큰 사용
          borderRadius: 'var(--border-radius-lg)', // 라운드 LG (16px)
          ...sizeMap[size],
          ...style, // 커스텀 스타일 적용
        }}
      >
        {/* Header - Card의 overflow: hidden이 라운드를 처리하므로 별도 borderRadius 불필요 */}
        {title && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 'var(--spacing-md)',
              paddingBottom: 'var(--spacing-sm)',
              backgroundColor: 'var(--color-primary)',
              borderBottom: 'var(--border-width-thin) solid var(--color-primary-dark)',
              flexShrink: 0,
            }}
          >
            <h2
              style={{
                fontWeight: 'var(--font-weight-semibold)',
                color: 'var(--color-white)',
                margin: 'var(--spacing-none)', // styles.css 준수: spacing 토큰 사용
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
                padding: 'var(--spacing-none)', // styles.css 준수: spacing 토큰 사용
                fontSize: 'var(--font-size-3xl)',
                color: 'var(--color-white)',
                fontWeight: 'var(--font-weight-medium)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                lineHeight: 'var(--line-height-tight)', // styles.css 준수: 타이틀과 버튼 수평 정렬용 토큰 사용
                opacity: 'var(--opacity-90)', // styles.css 준수: opacity 토큰 사용
                transition: 'opacity var(--transition-base)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = 'var(--opacity-100)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = 'var(--opacity-90)';
              }}
            >
              ×
            </button>
          </div>
        )}

        {/* Content */}
        <div
          className="ui-core-hiddenScrollbar"
          style={{
            padding: 'var(--spacing-lg)',
            paddingBottom: 'var(--spacing-lg)',
            overflowY: 'auto',
            flex: 1,
            marginBottom: footer ? 'var(--spacing-none)' : 'var(--spacing-xl)',
          }}
        >
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div
            style={{
              padding: 'var(--spacing-lg)',
              paddingTop: 'var(--spacing-md)',
              borderTop: 'var(--border-width-thin) solid var(--color-gray-200)', // styles.css 준수: border-width 토큰 사용
              flexShrink: 0,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: 'var(--spacing-sm)',
                width: '100%',
              }}
            >
              {footer}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

