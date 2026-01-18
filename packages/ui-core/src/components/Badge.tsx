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
  onClick?: () => void;
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
  onClick,
}) => {
  const [isHovered, setIsHovered] = React.useState(false);
  // 화사한 배지 색상 (한 톤 어둡게 조정)
  const colorMap: Record<ColorToken | 'blue' | 'gray' | 'green' | 'yellow', {
    main: string;
    light: string;
    dark: string;
    bg50: string;
  }> = {
    primary: {
      main: '#4A7AE0', // 파랑 (한 톤 다크)
      light: '#5B8DEF',
      dark: '#4A7AE0',
      bg50: '#E3EDFF',
    },
    secondary: {
      main: '#9371F0', // 보라 (한 톤 다크)
      light: '#A78BFA',
      dark: '#9371F0',
      bg50: '#EDE9FE',
    },
    success: {
      main: '#34C66A', // 초록 (한 톤 다크)
      light: '#4ADE80',
      dark: '#34C66A',
      bg50: '#E6F9ED',
    },
    warning: {
      main: '#F0A500', // 노랑/금색 (한 톤 다크)
      light: '#FBBF24',
      dark: '#F0A500',
      bg50: '#FEF5DC',
    },
    error: {
      main: '#EF5050', // 빨강/코랄 (한 톤 다크)
      light: '#F87171',
      dark: '#EF5050',
      bg50: '#FDE8E8',
    },
    info: {
      main: '#0EBDD4', // 시안/청록 (한 톤 다크)
      light: '#22D3EE',
      dark: '#0EBDD4',
      bg50: '#E0F7FA',
    },
    blue: {
      main: '#4A7AE0', // 파랑 (한 톤 다크)
      light: '#5B8DEF',
      dark: '#4A7AE0',
      bg50: '#E3EDFF',
    },
    gray: {
      main: '#7B8494', // 회색 (한 톤 다크)
      light: '#9CA3AF',
      dark: '#7B8494',
      bg50: '#F3F4F6',
    },
    green: {
      main: '#34C66A', // 초록 (한 톤 다크)
      light: '#4ADE80',
      dark: '#34C66A',
      bg50: '#E6F9ED',
    },
    yellow: {
      main: '#F0A500', // 노랑/금색 (한 톤 다크)
      light: '#FBBF24',
      dark: '#F0A500',
      bg50: '#FEF5DC',
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
    ...(onClick && {
      cursor: 'pointer',
      transition: 'var(--transition-all)',
      opacity: isHovered ? 0.8 : 1,
    }),
    ...style,
  };

  return onClick ? (
    <button
      type="button"
      className={clsx(className)}
      style={badgeStyle}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {children}
    </button>
  ) : (
    <span className={clsx(className)} style={badgeStyle}>
      {children}
    </span>
  );
};

