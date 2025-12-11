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
import { Button } from './Button';
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
  width = '320px',
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
              marginBottom: 'var(--spacing-md)',
              paddingBottom: 'var(--spacing-md)',
              borderBottom: '1px solid var(--color-gray-200)',
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
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              style={{
                minWidth: '44px',
                minHeight: '44px',
              }}
            >
              ✕
            </Button>
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

