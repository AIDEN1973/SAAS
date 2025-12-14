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
  onMouseEnter?: (e: React.MouseEvent<HTMLDivElement>) => void;
  onMouseLeave?: (e: React.MouseEvent<HTMLDivElement>) => void;
}

export const Card: React.FC<CardProps> = ({
  children,
  padding = 'md',
  className,
  style,
  onClick,
  variant = 'default',
  onMouseEnter,
  onMouseLeave,
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
      border: 'var(--border-width-thin) solid var(--color-gray-200)', // styles.css 준수: border-width 토큰 사용
      boxShadow: 'none',
    },
    elevated: {
      backgroundColor: 'var(--color-white)',
      border: 'none',
      boxShadow: 'none',
    },
    outlined: {
      backgroundColor: 'var(--color-white)',
      border: 'var(--border-width-thin) solid var(--color-gray-200)', // styles.css 준수: border-width 토큰 사용
      boxShadow: 'none',
    },
  };

  const cardStyle: React.CSSProperties = {
    borderRadius: 'var(--border-radius-sm)',
    padding: paddingMap[padding],
    ...variantStyles[variant],
    ...(onClick && {
      cursor: 'pointer',
      transition: 'var(--transition-all)', // styles.css 준수: transition 토큰 사용
    }),
    ...style,
  };

  const handleMouseEnter = (e: React.MouseEvent<HTMLDivElement>) => {
    if (onClick) {
      e.currentTarget.style.boxShadow = 'none';
      e.currentTarget.style.transform = 'var(--transform-lift-hover)'; // styles.css 준수: transform 토큰 사용
    }
    onMouseEnter?.(e);
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
    if (onClick) {
      e.currentTarget.style.boxShadow = 'none';
      e.currentTarget.style.transform = 'var(--transform-scale-normal)'; // styles.css 준수: transform 토큰 사용
    }
    onMouseLeave?.(e);
  };

  return (
    <div
      className={clsx(className)}
      style={cardStyle}
      onClick={onClick}
      onMouseEnter={onClick || onMouseEnter ? handleMouseEnter : undefined}
      onMouseLeave={onClick || onMouseLeave ? handleMouseLeave : undefined}
    >
      {children}
    </div>
  );
};
