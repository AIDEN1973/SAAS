/**
 * Card Component
 *
 * [불변 규칙] 스키마에서는 Tailwind 클래스를 직접 사용하지 않습니다.
 * [불변 규칙] 모든 스타일은 design-system 토큰을 사용합니다.
 */

import React from 'react';
import { clsx } from 'clsx';
import { SpacingToken } from '@design-system/core';

export interface CardProps {
  children: React.ReactNode;
  padding?: SpacingToken;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
  variant?: 'default' | 'elevated' | 'outlined';
}

export const Card: React.FC<CardProps> = ({
  children,
  padding = 'md',
  className,
  style,
  onClick,
  variant = 'default',
}) => {
  const paddingMap: Record<SpacingToken, string> = {
    xs: 'var(--spacing-xs)',
    sm: 'var(--spacing-sm)',
    md: 'var(--spacing-md)',
    lg: 'var(--spacing-lg)',
    xl: 'var(--spacing-xl)',
    '2xl': 'var(--spacing-2xl)',
    '3xl': 'var(--spacing-3xl)',
  };

  const variantStyles: Record<'default' | 'elevated' | 'outlined', React.CSSProperties> = {
    default: {
      backgroundColor: 'var(--color-white)',
      border: '1px solid var(--color-gray-200)',
      boxShadow: 'var(--shadow-sm)',
    },
    elevated: {
      backgroundColor: 'var(--color-white)',
      border: 'none',
      boxShadow: 'var(--shadow-lg)',
    },
    outlined: {
      backgroundColor: 'var(--color-white)',
      border: '1px solid var(--color-gray-200)',
      boxShadow: 'none',
    },
  };

  const cardStyle: React.CSSProperties = {
    borderRadius: 'var(--border-radius-xl)',
    padding: paddingMap[padding],
    ...variantStyles[variant],
    ...(onClick && {
      cursor: 'pointer',
      transition: 'all 0.2s ease',
    }),
    ...style,
  };

  return (
    <div
      className={clsx(className)}
      style={cardStyle}
      onClick={onClick}
      onMouseEnter={onClick ? (e) => {
        e.currentTarget.style.boxShadow = 'var(--shadow-xl)';
        e.currentTarget.style.transform = 'translateY(-2px)';
      } : undefined}
      onMouseLeave={onClick ? (e) => {
        e.currentTarget.style.boxShadow = variant === 'elevated' ? 'var(--shadow-lg)' : 'var(--shadow-sm)';
        e.currentTarget.style.transform = 'translateY(0)';
      } : undefined}
    >
      {children}
    </div>
  );
};
