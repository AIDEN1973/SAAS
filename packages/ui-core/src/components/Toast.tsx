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
        setTimeout(() => onClose?.(), 300); // 애니메이션 대기 (transition-slow = 300ms)
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
        minWidth: 'var(--width-card-min)', // styles.css 준수: 카드 최소 너비 토큰 사용
        maxWidth: '90vw',
        backgroundColor: 'var(--color-white)',
        borderLeft: `var(--border-width-thick) solid ${colorMap[color]}`, // styles.css 준수: border-width 토큰 사용
        opacity: isVisible ? 'var(--opacity-full)' : 0, // styles.css 준수: opacity 토큰 사용
        transition: 'opacity var(--transition-slow)', // styles.css 준수: transition 토큰 사용
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
              minWidth: 'var(--size-avatar-sm)', // styles.css 준수: 아바타 작은 크기 토큰 사용 (32px)
              minHeight: 'var(--size-avatar-sm)', // styles.css 준수: 아바타 작은 크기 토큰 사용 (32px)
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
