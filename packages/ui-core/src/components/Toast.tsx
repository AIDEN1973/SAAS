/**
 * Toast Component
 *
 * [불변 규칙] 스키마에서 Tailwind 클래스를 직접 사용하지 않는다.
 * [불변 규칙] 모든 스타일은 design-system 토큰을 사용한다.
 */

import React, { useEffect, useState } from 'react';
import { clsx } from 'clsx';
import { Card } from './Card';
import { Button } from './Button';
import { ColorToken } from '@design-system/core';

export interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
  onClose?: () => void;
  className?: string;
}

/**
 * Toast 컴포넌트
 *
 * 알림 메시지를 표시하는 토스트
 */
export const Toast: React.FC<ToastProps> = ({
  message,
  type = 'info',
  duration = 3000,
  onClose,
  className,
}) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(() => onClose?.(), 300); // 애니메이션 대기
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  if (!isVisible) return null;

  const typeMap: Record<'success' | 'error' | 'warning' | 'info', ColorToken> = {
    success: 'success',
    error: 'error',
    warning: 'warning',
    info: 'info',
  };

  const color = typeMap[type];

  const colorMap: Record<ColorToken, string> = {
    primary: 'var(--color-primary)',
    secondary: 'var(--color-secondary)',
    success: 'var(--color-success)',
    warning: 'var(--color-warning)',
    error: 'var(--color-error)',
    info: 'var(--color-info)',
  };

  return (
    <Card
      variant="elevated"
      padding="md"
      className={clsx(className)}
      style={{
        position: 'fixed',
        bottom: 'var(--spacing-lg)',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 'var(--z-toast)',
        minWidth: '300px',
        maxWidth: '90vw',
        backgroundColor: 'var(--color-white)',
        borderLeft: `4px solid ${colorMap[color]}`,
        opacity: isVisible ? 1 : 0,
        transition: 'opacity 0.3s ease',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--spacing-md)',
        }}
      >
        <span
          style={{
            color: 'var(--color-text)',
            flex: 1,
          }}
        >
          {message}
        </span>
        {onClose && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setIsVisible(false);
              setTimeout(() => onClose(), 300);
            }}
            style={{
              minWidth: '32px',
              minHeight: '32px',
              padding: 0,
            }}
          >
            ×
          </Button>
        )}
      </div>
    </Card>
  );
};
