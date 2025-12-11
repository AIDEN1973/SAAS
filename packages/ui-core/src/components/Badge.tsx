/**
 * Badge Component
 *
 * [불변 규칙] 스키마에서는 Tailwind 클래스를 직접 사용하지 않습니다.
 * [불변 규칙] 모든 스타일은 design-system 토큰을 사용합니다.
 */

import React from 'react';
import { clsx } from 'clsx';
import { ColorToken, SizeToken } from '@design-system/core';

export interface BadgeProps {
  children: React.ReactNode;
  color?: ColorToken | 'blue' | 'gray' | 'green';
  size?: SizeToken;
  variant?: 'solid' | 'outline' | 'soft';
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Badge 컴포넌트
 *
 * 태그, 상태 표시 등에 사용
 */
export const Badge: React.FC<BadgeProps> = ({
  children,
  color = 'primary',
  size = 'md',
  variant = 'solid',
  className,
  style,
}) => {
  const colorMap: Record<ColorToken | 'blue' | 'gray' | 'green', {
    main: string;
    light: string;
    dark: string;
    bg50: string;
  }> = {
    primary: {
      main: 'var(--color-primary)',
      light: 'var(--color-primary-light)',
      dark: 'var(--color-primary-dark)',
      bg50: 'var(--color-primary-50)',
    },
    secondary: {
      main: 'var(--color-secondary)',
      light: 'var(--color-secondary-light)',
      dark: 'var(--color-secondary-dark)',
      bg50: 'var(--color-secondary-50)',
    },
    success: {
      main: 'var(--color-success)',
      light: 'var(--color-success-light)',
      dark: 'var(--color-success-dark)',
      bg50: 'var(--color-success-50)',
    },
    warning: {
      main: 'var(--color-warning)',
      light: 'var(--color-warning-light)',
      dark: 'var(--color-warning-dark)',
      bg50: 'var(--color-warning-50)',
    },
    error: {
      main: 'var(--color-error)',
      light: 'var(--color-error-light)',
      dark: 'var(--color-error-dark)',
      bg50: 'var(--color-error-50)',
    },
    info: {
      main: 'var(--color-info)',
      light: 'var(--color-info-light)',
      dark: 'var(--color-info-dark)',
      bg50: 'var(--color-info-50)',
    },
    blue: {
      main: '#3b82f6',
      light: '#60a5fa',
      dark: '#2563eb',
      bg50: 'rgba(59, 130, 246, 0.1)',
    },
    gray: {
      main: '#6b7280',
      light: '#9ca3af',
      dark: '#4b5563',
      bg50: 'rgba(107, 114, 128, 0.1)',
    },
    green: {
      main: '#10b981',
      light: '#34d399',
      dark: '#059669',
      bg50: 'rgba(16, 185, 129, 0.1)',
    },
  };

  const colorVars = colorMap[color || 'primary'];

  const sizeStyles: Record<SizeToken, React.CSSProperties> = {
    xs: {
      padding: 'var(--spacing-xs) var(--spacing-sm)',
      lineHeight: 1.2,
    },
    sm: {
      padding: 'var(--spacing-xs) var(--spacing-sm)',
      lineHeight: 1.2,
    },
    md: {
      padding: 'var(--spacing-xs) var(--spacing-sm)',
      lineHeight: 1.3,
    },
    lg: {
      padding: 'var(--spacing-sm) var(--spacing-md)',
      lineHeight: 1.4,
    },
    xl: {
      padding: 'var(--spacing-sm) var(--spacing-md)',
      lineHeight: 1.4,
    },
  };

  const variantStyles: Record<'solid' | 'outline' | 'soft', React.CSSProperties> = {
    solid: {
      backgroundColor: colorVars.dark,
      color: 'var(--color-white)',
      border: 'none',
    },
    outline: {
      backgroundColor: 'transparent',
      color: colorVars.main,
      border: `1px solid ${colorVars.main}`,
    },
    soft: {
      backgroundColor: colorVars.bg50,
      color: colorVars.dark,
      border: 'none',
    },
  };

  const badgeStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 'var(--border-radius-sm)',
    fontWeight: 'var(--font-weight-medium)',
    whiteSpace: 'nowrap',
    ...sizeStyles[size],
    ...variantStyles[variant],
    ...style,
  };

  return (
    <span className={clsx(className)} style={badgeStyle}>
      {children}
    </span>
  );
};

