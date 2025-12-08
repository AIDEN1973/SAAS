/**
 * Modal Component
 * 
 * [불�? 규칙] ?�키마에??Tailwind ?�래?��? 직접 ?�용?��? ?�는??
 * [불�? 규칙] 모든 ?��??��? design-system ?�큰???�용?�다.
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
 * Modal 컴포?�트
 * 
 * ?�버?�이?� ?�께 ?�시?�는 모달 ?�이?�로�?
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
      width: isMobile ? '90%' : '400px',
      maxWidth: '90vw',
    },
    md: {
      width: isMobile ? '90%' : '500px',
      maxWidth: '90vw',
    },
    lg: {
      width: isMobile ? '95%' : '700px',
      maxWidth: '95vw',
    },
    xl: {
      width: isMobile ? '95%' : '900px',
      maxWidth: '95vw',
    },
    full: {
      width: '100%',
      height: '100%',
      maxWidth: '100vw',
      maxHeight: '100vh',
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
          maxHeight: isMobile ? '90vh' : '85vh',
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
              borderBottom: '1px solid var(--color-gray-200)',
            }}
          >
            <h2
              style={{
                fontSize: 'var(--font-size-lg)',
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
              aria-label="닫기"
            >
              ×
            </Button>
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
              borderTop: '1px solid var(--color-gray-200)',
            }}
          >
            {footer}
          </div>
        )}
      </Card>
    </div>
  );
};

