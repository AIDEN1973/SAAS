/**
 * Modal Component
 *
 * [불변 규칙] 스키마에서는 Tailwind 클래스를 직접 사용하지 않습니다.
 * [불변 규칙] 모든 스타일은 design-system 토큰을 사용합니다.
 */

import React, { useEffect } from 'react';
import { clsx } from 'clsx';
import { Card } from './Card';
import { Button } from './Button';
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
        padding="lg"
        style={{
          position: 'relative',
          zIndex: 'var(--z-modal)',
          maxHeight: isMobile ? 'var(--height-modal-max-mobile)' : 'var(--height-modal-max)', // styles.css 준수: 모달 높이 토큰 사용
          overflow: 'auto',
          ...sizeMap[size],
        }}
      >
        {/* Header */}
        {title && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 'var(--spacing-md)',
              paddingBottom: 'var(--spacing-md)',
              borderBottom: 'var(--border-width-thin) solid var(--color-gray-200)', // styles.css 준수: border-width 토큰 사용
            }}
          >
            <h2
              style={{
                fontWeight: 'var(--font-weight-semibold)',
                color: 'var(--color-text)',
                margin: 0,
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
                fontSize: 'var(--font-size-2xl)',
                color: 'var(--color-text-secondary)',
                fontWeight: 'var(--font-weight-normal)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                lineHeight: 'var(--line-height-tight)', // styles.css 준수: 타이틀과 버튼 수평 정렬용 토큰 사용
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              ×
            </button>
          </div>
        )}

        {/* Content */}
        <div
          style={{
            marginBottom: footer ? 'var(--spacing-md)' : 0,
          }}
        >
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 'var(--spacing-sm)',
              paddingTop: 'var(--spacing-md)',
              borderTop: 'var(--border-width-thin) solid var(--color-gray-200)', // styles.css 준수: border-width 토큰 사용
            }}
          >
            {footer}
          </div>
        )}
      </Card>
    </div>
  );
};

