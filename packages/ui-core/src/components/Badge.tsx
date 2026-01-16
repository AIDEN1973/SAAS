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
  color?: ColorToken | 'blue' | 'gray' | 'green' | 'yellow';
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
  const colorMap: Record<ColorToken | 'blue' | 'gray' | 'green' | 'yellow', {
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
      main: 'var(--color-info)', // styles.css 준수: info 색상 사용
      light: 'var(--color-info-light)',
      dark: 'var(--color-info-dark)',
      bg50: 'var(--color-info-50)',
    },
    gray: {
      main: 'var(--color-gray-500)', // styles.css 준수: gray 색상 사용
      light: 'var(--color-gray-400)',
      dark: 'var(--color-gray-600)',
      bg50: 'var(--color-gray-50)',
    },
    green: {
      main: 'var(--color-success)', // styles.css 준수: success 색상 사용
      light: 'var(--color-success-light)',
      dark: 'var(--color-success-dark)',
      bg50: 'var(--color-success-50)',
    },
    yellow: {
      main: 'var(--color-warning)', // styles.css 준수: warning 색상 사용
      light: 'var(--color-warning-light)',
      dark: 'var(--color-warning-dark)',
      bg50: 'var(--color-warning-50)',
    },
  };

  const colorVars = colorMap[color || 'primary'];

  const sizeStyles: Record<SizeToken, React.CSSProperties> = {
    xs: {
      padding: 'var(--spacing-xs) var(--spacing-sm)', // 패딩 축소
      lineHeight: 'var(--line-height)', // styles.css 준수: line-height 토큰 사용
      fontSize: 'var(--font-size-xs)', // 폰트 크기 xs
    },
    sm: {
      padding: 'var(--spacing-xs) var(--spacing-sm)', // 패딩 축소
      lineHeight: 'var(--line-height)', // styles.css 준수: line-height 토큰 사용
      fontSize: 'var(--font-size-xs)', // 폰트 크기 xs (한 포인트 작게)
    },
    md: {
      padding: 'var(--spacing-xs) var(--spacing-md)', // 좌우 여백 1포인트 늘림 (sm → md)
      lineHeight: 'var(--line-height)', // styles.css 준수: line-height 토큰 사용
      fontSize: 'var(--font-size-sm)', // 폰트 크기 sm
    },
    lg: {
      padding: 'var(--spacing-sm) var(--spacing-lg)', // 좌우 여백 1포인트 늘림 (md → lg)
      lineHeight: 'var(--line-height)', // styles.css 준수: line-height 토큰 사용
      fontSize: 'var(--font-size-base)', // 폰트 크기 base
    },
    xl: {
      padding: 'var(--spacing-sm) var(--spacing-lg)', // 좌우 여백 1포인트 늘림 (md → lg)
      lineHeight: 'var(--line-height)', // styles.css 준수: line-height 토큰 사용
      fontSize: 'var(--font-size-lg)', // 폰트 크기 lg
    },
  };

  const variantStyles: Record<'solid' | 'outline' | 'soft', React.CSSProperties> = {
    solid: {
      backgroundColor: colorVars.dark || 'var(--color-white)', // 배경색 진하게 (dark 사용), 없으면 화이트
      color: 'var(--color-white)', // 폰트 색상 화이트
      border: 'none',
    },
    outline: {
      backgroundColor: 'var(--color-white)', // 배경색 화이트
      color: colorVars.main || 'var(--color-text)',
      border: `var(--border-width-thin) solid ${colorVars.main || 'var(--color-border)'}`, // styles.css 준수: border-width 토큰 사용
    },
    soft: {
      backgroundColor: colorVars.bg50 || 'var(--color-white)', // 연한 배경색, 없으면 화이트
      color: colorVars.dark || 'var(--color-text)', // 폰트 색상
      border: 'none',
    },
  };

  const badgeStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 'var(--border-radius-lg)', // 라운드 lg 적용
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

