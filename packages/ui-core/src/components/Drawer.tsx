/**
 * Drawer Component
 * 
 * [Î∂àÎ? Í∑úÏπô] ?§ÌÇ§ÎßàÏóê??Tailwind ?¥Îûò?§Î? ÏßÅÏ†ë ?¨Ïö©?òÏ? ?äÎäî??
 * [Î∂àÎ? Í∑úÏπô] Î™®Îì† ?§Ì??ºÏ? design-system ?†ÌÅ∞???¨Ïö©?úÎã§.
 * [Î∂àÎ? Í∑úÏπô] Î™®Î∞î???òÍ≤Ω?êÏÑú Fullscreen Drawer ?¨Ïö©
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
 * Drawer Ïª¥Ìè¨?åÌä∏
 * 
 * Î™®Î∞î?? Fullscreen Drawer
 * ?∞Ïä§?¨ÌÜ±: ?¨Ïù¥??Drawer
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
            >
              ??
            </Button>
          </div>
        )}

        {/* Content */}
        <div
          style={{
            flex: 1,
            overflow: 'auto',
          }}
        >
          {children}
        </div>
      </Card>
    </div>
  );
};

